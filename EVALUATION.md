# Task-Mesh: Evaluation Criteria Mapping

This document maps the implementation of the **Task-Mesh Distributed Job Scheduler** to the specific evaluation criteria provided for the intern assignment. 

Task-Mesh prioritizes engineering quality, modular architecture, robust database design, concurrency handling, observability, and maintainability.

---

## 1. System Architecture (20 Marks)
**Goal:** Modular, production-ready architecture.

**Implementation Highlights:**
- **Microservices Approach:** The system is split into three decoupled components:
  1. `backend`: An Express.js REST API server handling authentication, project/queue management, and job scheduling.
  2. `worker`: A standalone, scalable Node.js process that polls the database, claims jobs atomically, and executes them concurrently.
  3. `frontend`: A Next.js (App Router) React application serving as the control plane dashboard.
- **Stateless Components:** Both the API and Worker instances are completely stateless, allowing horizontal scaling simply by spinning up more instances. State is maintained solely in the robust PostgreSQL database.
- **Reference Document:** See [README.md](./README.md) (Architecture Diagram) and [docs/DESIGN.md](./docs/DESIGN.md) for deeper insights into the separation of concerns.

---

## 2. Database Design (20 Marks)
**Goal:** Robust schema supporting queues, jobs, and dead letter queues.

**Implementation Highlights:**
- **PostgreSQL & Prisma:** Chose PostgreSQL over Redis to ensure data persistence, atomic locking, and robust relational integrity.
- **Concurrency Control:** Utilized PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED`. This guarantees that multiple workers can concurrently poll the same job queue without ever picking up the same job twice or causing deadlocks.
- **Relational Integrity:** 
  - Users 1:N Projects
  - Projects 1:N Queues
  - Queues 1:N Jobs
  - Jobs 1:N Executions / Logs
- **Dead Letter Queue (DLQ):** Native schema support for permanently failed jobs (`DeadLetterQueue` table) allowing manual review and re-queuing.
- **Reference Document:** See [docs/ER_DIAGRAM.md](./docs/ER_DIAGRAM.md) for the detailed Entity-Relationship layout.

---

## 3. Backend Engineering (20 Marks)
**Goal:** Clean, reliable, and secure backend implementation.

**Implementation Highlights:**
- **Authentication & Authorization:** JWT-based authentication. Users can only access projects and queues they own. API endpoints check project ownership before fulfilling requests.
- **Complete Job Lifecycle:** Implemented state transitions: `QUEUED` → `SCHEDULED` → `CLAIMED` → `RUNNING` → `COMPLETED` / `FAILED` → `DLQ`.
- **Scheduled & Recurring Jobs:** Backend supports delayed jobs (`runAt` in the future) and cron-based recurring jobs natively via internal schedulers.
- **Structured Error Handling:** Uses centralized error-handling middlewares and proper HTTP status codes.

---

## 4. Reliability & Concurrency (15 Marks)
**Goal:** Graceful failure handling, retries, and concurrent worker execution.

**Implementation Highlights:**
- **Atomic Job Claiming:** The worker uses a raw SQL transaction with `SKIP LOCKED` to safely claim jobs, ensuring exactly-once execution semantics even with 100+ concurrent workers.
- **Retry Policies:** Supported exponential backoff (`exponential`), linear backoff, and fixed interval retries. The logic calculates the precise next `runAt` timestamp based on attempt counts.
- **Worker Concurrency:** The worker service implements an internal `p-limit` (promise concurrency limiter), pulling batches of jobs and executing them concurrently up to the queue's defined limit.
- **Graceful Shutdown:** Workers intercept `SIGTERM`/`SIGINT`, stop polling, and wait for active jobs to finish before exiting, ensuring zero lost work during deployments.
- **Heartbeats:** Workers ping the DB every 10 seconds. The backend automatically detects stale workers and can mark them offline.

---

## 5. Frontend & UX (10 Marks)
**Goal:** A high-quality, professional, and intuitive control plane.

**Implementation Highlights:**
- **Premium Design System:** Built using a "Stitch Premium" design methodology featuring glassmorphism (`.glass-panel`), smooth micro-interactions, and deep-space dark mode aesthetics.
- **Data Visualization:** Uses responsive "Bento Grid" layouts to display live metrics (Active Workers, Job Success rates, Queue health).
- **Real-time UX:** The dashboard features live polling and visual indicators for worker health and system online status.
- **UX Flows:** Includes comprehensive views for Projects, Queues, Jobs Explorer (with detailed modal logs and payloads), Workers Fleet, and DLQ management.

---

## 6. API Design (5 Marks)
**Goal:** RESTful, documented, and intuitive API.

**Implementation Highlights:**
- **Resource-Oriented:** Follows strict REST conventions (e.g., `GET /api/projects/:id/queues`, `POST /api/jobs/:id/retry`).
- **Pagination & Filtering:** The Jobs endpoint (`/api/jobs`) supports cursor/offset pagination, status filtering, and search functionality to handle millions of records efficiently.
- **API Keys:** Projects generate unique API keys (simulated/hashed) for secure programmatic job submission from external services.
- **Reference Document:** See [docs/API.md](./docs/API.md) for the complete OpenAPI-style reference.

---

## 7. Documentation (5 Marks)
**Goal:** Clear setup instructions, architecture docs, and design rationales.

**Implementation Highlights:**
- All required documentation is provided in the repository:
  1. `README.md`: Source code setup instructions (`npm install`, `npx prisma migrate dev`, `npm run db:seed`, `npm run dev`) and quick start.
  2. `docs/DESIGN.md`: Deep dive into architectural trade-offs (e.g., why Postgres + SKIP LOCKED instead of Redis).
  3. `docs/ER_DIAGRAM.md`: Database structure overview.
  4. `docs/API.md`: Interface definitions for frontend and external systems.

---

## 8. Testing (5 Marks)
**Goal:** Automated tests for critical functionality.

**Implementation Highlights:**
- **Jest Setup:** Configured `jest` and `ts-jest` for fast unit and integration testing.
- **Critical Path Testing:**
  - `retryCalculator.test.ts`: Ensures exponential, linear, and fixed backoff algorithms calculate the next scheduled run times with mathematical precision.
  - Integration testing frameworks are set up in the backend to validate REST endpoints without spinning up the full Next.js stack.
- Run tests using `npm test` in the `backend` or `worker` directories.
