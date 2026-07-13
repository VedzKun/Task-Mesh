# Task-Mesh: Design Decisions & Trade-offs

## 1. Database as Queue: PostgreSQL + SKIP LOCKED

### Decision
We use PostgreSQL as the job queue rather than Redis or a message broker like RabbitMQ.

### Rationale
- **Simplicity**: One less moving part in the infrastructure stack.
- **ACID Transactions**: Job state changes are fully transactional. A claim and status update happen atomically — no partial updates.
- **Observability**: Jobs are queryable with SQL — inspect them with any DB tool.
- **`SELECT ... FOR UPDATE SKIP LOCKED`**: This PostgreSQL feature is purpose-built for job queues. Multiple workers can poll simultaneously, and each row is locked exclusively to one worker, preventing duplicate execution without any distributed lock manager.

### Trade-off
- PostgreSQL is not as fast as Redis for pure throughput. For very high-volume queues (millions of jobs/sec), a dedicated message broker would outperform this design. For the vast majority of production workloads (up to ~10K jobs/min), PostgreSQL is more than sufficient.

---

## 2. Worker Polling vs. Push-based (e.g., Pub/Sub)

### Decision
Workers poll the database on a configurable interval (default: 2 seconds) rather than using a push-based notification system.

### Rationale
- **Simplicity**: No extra infrastructure (Redis pub/sub, LISTEN/NOTIFY setup).
- **Resilience**: Workers recover automatically from network partitions or restarts — they simply start polling again.
- **Back-pressure**: Workers only fetch jobs when they have capacity (`activeJobs < CONCURRENCY`), providing natural back-pressure.

### Trade-off
- Polling introduces up to ~2 seconds of latency between job submission and start. For near-real-time systems, implementing PostgreSQL `LISTEN/NOTIFY` would reduce this to milliseconds.

---

## 3. Retry Strategy Architecture (Open/Closed Principle)

### Decision
Retry strategies (FIXED, LINEAR, EXPONENTIAL) are implemented as a `switch` statement in `retryCalculator.ts` with a shared interface.

### Rationale
- Each strategy is closed for modification: adding a new strategy (e.g., `FIBONACCI`) only requires adding a new `case` — no existing code changes.
- Jitter (±10%) is added to all delays to prevent the "thundering herd" problem where all retried jobs attempt at exactly the same time.

---

## 4. Atomic Claiming Prevents Duplicate Execution

### Decision
Job claiming uses a database transaction that wraps `SELECT FOR UPDATE SKIP LOCKED` with an `UPDATE status = 'CLAIMED'`.

### Rationale
This is the key concurrency guarantee: even if 100 workers all poll simultaneously, each job is only handed to exactly one worker. The database lock prevents any second worker from reading a row that's already been locked by a first. `SKIP LOCKED` is critical — without it, workers would wait in a queue for each other, eliminating all concurrency benefits.

---

## 5. Job Idempotency

### Decision
Jobs can be submitted with an `idempotencyKey`. The system returns the existing job if the key already exists (HTTP 200 with `idempotent: true`).

### Rationale
In distributed systems, network failures can cause retransmissions. A job submission client might retry its HTTP request, not knowing if the first request succeeded. Idempotency keys prevent duplicate job creation in this scenario.

---

## 6. Zombie Job Reclamation

### Decision
An internal cron job runs every 10 seconds and re-queues any jobs that have been in `CLAIMED` or `RUNNING` status for more than 2 minutes.

### Rationale
If a worker crashes mid-execution, its claimed jobs remain locked forever without this mechanism. The timeout-based reclamation handles worker death gracefully without needing distributed lease management.

---

## 7. Dead Letter Queue (DLQ)

### Decision
When a job exhausts its `maxRetries`, it transitions to `DLQ` status and a `DeadLetterQueue` record is created with the original payload and failure reason.

### Rationale
- Jobs are never silently discarded — they're preserved in a queryable state.
- Operations can inspect, fix, and retry DLQ jobs via the dashboard or API.
- The `resolvedAt` timestamp provides an audit trail of DLQ resolution.

---

## 8. WebSocket for Live Dashboard

### Decision
The API server maintains a WebSocket server that broadcasts system metrics (worker count, queued/running jobs) every 5 seconds.

### Rationale
The dashboard provides live updates without requiring page refreshes. The broadcast approach is efficient — metrics are computed once and sent to all connected clients, rather than each client polling individually.

---

## 9. API Key Design

### Decision
API keys are generated as random tokens, stored only as SHA-256 hashes, and displayed in full only once at creation time.

### Rationale
- If the database is compromised, raw API keys are not exposed.
- The `apiKeyPrefix` (first 12 chars) allows users to identify which key is which without storing the full key.
- This follows the same security model used by GitHub, Stripe, and other major APIs.

---

## 10. Cascading Deletes

### Decision
Deleting a Project cascades to Queues → Jobs → Executions and Logs.

### Rationale
Orphaned records would consume storage and degrade query performance. Cascading deletes are specified at the database level (not just the application level), ensuring integrity even if data is modified outside the application.

---

## Database Index Strategy

| Index | Justification |
|-------|---------------|
| `(status, run_at)` on jobs | Primary poll query: `WHERE status = 'QUEUED' AND run_at <= NOW()` |
| `(status, priority, run_at)` on jobs | Enables priority-ordered polling without full table scan |
| `(queue_id, status)` on jobs | Queue-scoped status counts |
| `(worker_id, timestamp)` on heartbeats | Historical heartbeat queries |
| `(job_id, timestamp)` on job_logs | Ordered log retrieval per job |
