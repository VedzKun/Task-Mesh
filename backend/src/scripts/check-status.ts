import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- System Status ---');
  
  // 1. Workers
  const workers = await prisma.worker.findMany();
  console.log(`\nWorkers found in DB: ${workers.length}`);
  workers.forEach(w => {
    console.log(`- ID: ${w.id} | Host: ${w.hostname} | Status: ${w.status} | Last Heartbeat: ${w.lastHeartbeat.toISOString()}`);
  });

  // 2. Jobs status count
  const statusCounts = await prisma.job.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  console.log('\nJob Status Counts:');
  statusCounts.forEach(sc => {
    console.log(`- ${sc.status}: ${sc._count.id}`);
  });

  // 3. Executions count
  const executionCount = await prisma.jobExecution.count();
  console.log(`\nTotal Execution Records: ${executionCount}`);

  // 4. Stale/Heartbeat thresholds
  const STALE_MS = 30000;
  const activeWorkers = workers.filter(w => Date.now() - w.lastHeartbeat.getTime() < STALE_MS && w.status !== 'OFFLINE');
  console.log(`\nActive/Healthy Workers: ${activeWorkers.length}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
