import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Queueing 20 new jobs to test the scheduler...');

  // Find the queues
  const queues = await prisma.queue.findMany();
  if (queues.length === 0) {
    console.error('❌ No queues found. Please seed the database first.');
    return;
  }

  const jobNames = [
    'send-transactional-email',
    'resize-profile-image',
    'calculate-monthly-invoice',
    'sync-stripe-subscriptions',
    'generate-pdf-report',
  ];

  for (let i = 0; i < 20; i++) {
    const queue = queues[Math.floor(Math.random() * queues.length)];
    const name = jobNames[Math.floor(Math.random() * jobNames.length)];
    
    // Create the job in QUEUED state
    const job = await prisma.job.create({
      data: {
        queueId: queue.id,
        name: `${name}-${i + 1}`,
        payload: {
          jobIndex: i + 1,
          timestamp: new Date().toISOString(),
          testData: Math.random().toString(36).substring(7),
        },
        status: 'QUEUED',
        attempts: 0,
        maxRetries: 3,
        runAt: new Date(),
      },
    });

    console.log(`✅ Queued job: ${job.name} [ID: ${job.id}] on queue "${queue.name}"`);
  }

  console.log('\n🎉 Successfully queued all 20 test jobs! Check the worker logs and dashboard for real-time progress.');
}

main()
  .catch((e) => {
    console.error('Error queuing jobs:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
