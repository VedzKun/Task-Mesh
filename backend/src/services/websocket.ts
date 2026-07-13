import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

interface WSClient {
  ws: WebSocket;
  alive: boolean;
}

const clients = new Set<WSClient>();

export function startWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: WSClient = { ws, alive: true };
    clients.add(client);
    logger.debug('WebSocket client connected');

    ws.on('pong', () => { client.alive = true; });
    ws.on('close', () => clients.delete(client));
  });

  // Ping clients every 30s to detect dead connections
  setInterval(() => {
    clients.forEach((client) => {
      if (!client.alive) { client.ws.terminate(); clients.delete(client); return; }
      client.alive = false;
      client.ws.ping();
    });
  }, 30_000);

  // Broadcast system metrics every 5 seconds
  setInterval(async () => {
    if (clients.size === 0) return;
    try {
      const [activeWorkers, queuedJobs, runningJobs] = await Promise.all([
        prisma.worker.count({ where: { status: { in: ['IDLE', 'BUSY'] } } }),
        prisma.job.count({ where: { status: 'QUEUED' } }),
        prisma.job.count({ where: { status: 'RUNNING' } }),
      ]);
      broadcast({ type: 'METRICS_UPDATE', data: { activeWorkers, queuedJobs, runningJobs, timestamp: new Date() } });
    } catch {}
  }, 5_000);

  logger.info('WebSocket server started on /ws');
}

export function broadcast(payload: object) {
  const msg = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  });
}
