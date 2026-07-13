import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';

// These are integration tests — they require a test DB.
// Run with: DATABASE_URL=postgresql://... npx jest

let token: string;
let projectId: string;
let queueId: string;

beforeAll(async () => {
  // Create test user
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `test+${Date.now()}@example.com`, password: 'password123', name: 'Test User' });
  token = res.body.data.token;

  // Create test project
  const proj = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Project' });
  projectId = proj.body.data.id;

  // Create test queue
  const queue = await request(app)
    .post(`/api/projects/${projectId}/queues`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'test-queue', concurrencyLimit: 3 });
  queueId = queue.body.data.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { name: 'Test Project' } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('returns 422 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'pass', name: 'X' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/jobs', () => {
  it('creates an immediate job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ queueId, name: 'send-email', payload: { to: 'user@example.com' } });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.name).toBe('send-email');
  });

  it('respects idempotency key', async () => {
    const idempotencyKey = `idem-${Date.now()}`;
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ queueId, name: 'idempotent-job', idempotencyKey });
    const res2 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ queueId, name: 'idempotent-job', idempotencyKey });
    expect(res2.body.idempotent).toBe(true);
  });

  it('creates a batch of jobs atomically', async () => {
    const res = await request(app)
      .post('/api/jobs/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        jobs: [
          { queueId, name: 'batch-job-1' },
          { queueId, name: 'batch-job-2' },
          { queueId, name: 'batch-job-3' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBe(3);
  });
});

describe('Queue pause/resume', () => {
  it('can pause and resume a queue', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/queues/${queueId}/pause`)
      .set('Authorization', `Bearer ${token}`);
    const paused = await request(app)
      .get(`/api/projects/${projectId}/queues/${queueId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(paused.body.data.isPaused).toBe(true);

    await request(app)
      .post(`/api/projects/${projectId}/queues/${queueId}/resume`)
      .set('Authorization', `Bearer ${token}`);
    const resumed = await request(app)
      .get(`/api/projects/${projectId}/queues/${queueId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(resumed.body.data.isPaused).toBe(false);
  });
});

describe('Job cancel', () => {
  it('can cancel a queued job', async () => {
    const job = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ queueId, name: 'cancel-me' });
    const jobId = job.body.data.id;

    const cancel = await request(app)
      .post(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe('CANCELLED');
  });
});
