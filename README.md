# Task-Mesh: Distributed Job Scheduler

A production-inspired distributed job scheduling platform with support for multiple job types, configurable retry strategies, real-time monitoring, and a beautiful web dashboard.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Task-Mesh                              │
│                                                                │
│  ┌─────────────────┐     ┌───────────────────────────────────┐ │
│  │   Next.js        │────▶│         Express API              │ │
│  │   Dashboard      │◀────│  - REST endpoints (auth, jobs,   │ │
│  │   (Port 3000)    │ WS  │    queues, workers, metrics)     │ │
│  └─────────────────┘     │  - WebSocket server (/ws)        │ │
│                           │  - Internal cron scheduler       │ │
│                           └─────────────┬───────────────────┘ │
│                                         │ Prisma ORM          │
│                                         ▼                     │
│                           ┌─────────────────────────────────┐ │
│                           │      PostgreSQL Database         │ │
│                           │  SELECT FOR UPDATE SKIP LOCKED   │ │
│                           └─────────────┬───────────────────┘ │
│                                         │                     │
│             ┌───────────────────────────┘                     │
│             │ Poll (SKIP LOCKED)                              │
│             ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │             Worker Pool (1–N workers)                    │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │  │
│  │  │Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker N │      │  │
│  │  │         │ │         │ │         │ │         │      │  │
│  │  │Heartbeat│ │Heartbeat│ │Heartbeat│ │Heartbeat│      │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘      │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

### 1. Clone and setup

```bash
git clone https://github.com/yourusername/task-mesh
cd task-mesh
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed        # Seeds demo data (admin@taskmesh.dev / password123)
```

### 3. Configure Frontend

```bash
cd ../frontend
npm install
# .env.local already configured for localhost
```

### 4. Configure Worker

```bash
cd ../worker
npm install
cp ../backend/.env .env   # Worker needs same DATABASE_URL
```

### 5. Start all services

**Terminal 1 — Backend API:**
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

**Terminal 2 — Worker:**
```bash
cd worker
npm run dev
# Worker polls DB and processes jobs
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
# Dashboard at http://localhost:3000
```

**Login:** `admin@taskmesh.dev` / `password123`

---

## API Reference

See [docs/API.md](./docs/API.md) for complete API documentation.

## Design Decisions

See [docs/DESIGN.md](./docs/DESIGN.md) for architecture and trade-off explanations.

## ER Diagram

See [docs/ER_DIAGRAM.md](./docs/ER_DIAGRAM.md).

## Running Tests

```bash
cd backend
npm test
```
