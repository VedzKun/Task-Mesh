import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'admin@taskmesh.dev' },
    update: {},
    create: { email: 'admin@taskmesh.dev', passwordHash, name: 'Admin User', role: 'ADMIN' },
  });
  console.log(`✓ User: ${user.email}`);

  // Create a demo project
  const rawKey = `tmk_${randomBytes(24).toString('hex')}`;
  const apiKeyHash = createHash('sha256').update(rawKey).digest('hex');
  const project = await prisma.project.upsert({
    where: { apiKeyHash },
    update: {},
    create: {
      userId: user.id,
      name: 'Demo Project',
      description: 'Seeded demo project',
      apiKeyHash,
      apiKeyPrefix: rawKey.slice(0, 12),
    },
  });
  console.log(`✓ Project: ${project.name} | API Key: ${rawKey}`);

  // Create retry policies
  const retryPolicy = await prisma.retryPolicy.create({
    data: {
      name: 'Default Exponential',
      strategy: 'EXPONENTIAL',
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
    },
  });

  // Create queues
  const queues = await Promise.all([
    prisma.queue.create({
      data: { projectId: project.id, name: 'default', priority: 5, concurrencyLimit: 5, retryPolicyId: retryPolicy.id },
    }),
    prisma.queue.create({
      data: { projectId: project.id, name: 'critical', priority: 10, concurrencyLimit: 2, retryPolicyId: retryPolicy.id },
    }),
    prisma.queue.create({
      data: { projectId: project.id, name: 'email-notifications', priority: 3, concurrencyLimit: 10 },
    }),
  ]);
  console.log(`✓ Created ${queues.length} queues`);

  // Create sample jobs
  const jobNames = ['send-welcome-email', 'process-payment', 'generate-report', 'sync-users', 'cleanup-temp-files'];
  const statuses = ['QUEUED', 'COMPLETED', 'FAILED', 'DLQ'];

  for (let i = 0; i < 20; i++) {
    const queue = queues[Math.floor(Math.random() * queues.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)] as any;
    const name = jobNames[Math.floor(Math.random() * jobNames.length)];
    const attempts = status === 'DLQ' ? 3 : status === 'FAILED' ? 1 : status === 'COMPLETED' ? 1 : 0;

    const job = await prisma.job.create({
      data: {
        queueId: queue.id,
        name,
        payload: { demo: true, index: i },
        status,
        attempts,
        maxRetries: 3,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        lastError: status === 'FAILED' || status === 'DLQ' ? 'Simulated failure for demo' : undefined,
      },
    });

    if (status === 'DLQ') {
      await prisma.deadLetterQueue.create({
        data: { jobId: job.id, queueId: queue.id, reason: 'Simulated failure for demo', originalPayload: job.payload as any, attempts: 3 },
      });
    }
  }
  console.log('✓ Created 20 sample jobs');
  console.log('\n✅ Seeding complete!');
  console.log(`\n📧 Login: admin@taskmesh.dev / password123`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
