# Task-Mesh: Entity-Relationship Diagram

## Mermaid ER Diagram

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string name
        enum role
        timestamp created_at
        timestamp updated_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name
        string description
        string api_key_hash UK
        string api_key_prefix
        timestamp created_at
        timestamp updated_at
    }

    RETRY_POLICIES {
        uuid id PK
        string name
        enum strategy
        int max_attempts
        int base_delay_ms
        int max_delay_ms
        float multiplier
        timestamp created_at
    }

    QUEUES {
        uuid id PK
        uuid project_id FK
        uuid retry_policy_id FK
        string name
        string description
        int priority
        int concurrency_limit
        int rate_limit_per_min
        boolean is_paused
        timestamp created_at
        timestamp updated_at
    }

    JOBS {
        uuid id PK
        uuid queue_id FK
        uuid retry_policy_id FK
        uuid depends_on_job_id FK
        string name
        json payload
        enum status
        enum job_type
        timestamp run_at
        string cron_expression
        timestamp next_run_at
        int priority
        int max_retries
        int attempts
        string last_error
        timestamp locked_at
        string locked_by
        string batch_id
        string idempotency_key UK
        timestamp created_at
        timestamp updated_at
        timestamp completed_at
    }

    JOB_EXECUTIONS {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        int attempt
        enum status
        timestamp started_at
        timestamp completed_at
        int duration_ms
        string error_message
        string error_stack
        json result_data
    }

    JOB_LOGS {
        uuid id PK
        uuid job_id FK
        enum level
        string message
        json meta
        timestamp timestamp
    }

    WORKERS {
        uuid id PK
        string hostname
        int pid
        enum status
        int concurrency
        int current_jobs
        timestamp last_heartbeat
        timestamp registered_at
        json metadata
    }

    WORKER_HEARTBEATS {
        uuid id PK
        uuid worker_id FK
        int current_jobs
        float memory_mb
        float cpu_percent
        timestamp timestamp
    }

    DEAD_LETTER_QUEUE {
        uuid id PK
        uuid job_id FK UK
        uuid queue_id
        string reason
        json original_payload
        int attempts
        timestamp failed_at
        timestamp resolved_at
        string resolved_by
    }

    USERS ||--o{ PROJECTS : "owns"
    PROJECTS ||--o{ QUEUES : "contains"
    RETRY_POLICIES ||--o{ QUEUES : "default for"
    RETRY_POLICIES ||--o{ JOBS : "governs"
    QUEUES ||--o{ JOBS : "contains"
    JOBS ||--o{ JOB_EXECUTIONS : "has"
    JOBS ||--o{ JOB_LOGS : "produces"
    JOBS ||--o| DEAD_LETTER_QUEUE : "may enter"
    JOBS ||--o{ JOBS : "depends on"
    WORKERS ||--o{ JOB_EXECUTIONS : "performs"
    WORKERS ||--o{ WORKER_HEARTBEATS : "sends"
```

## Key Design Points

### Primary Keys
All PKs are UUIDs (v4) to:
- Support distributed ID generation (no central sequence)
- Prevent enumeration attacks on API endpoints
- Enable future database sharding

### Foreign Keys & Cascading
| Relationship | Cascade |
|---|---|
| Project → Queues | DELETE CASCADE |
| Queue → Jobs | DELETE CASCADE |
| Job → JobExecutions | DELETE CASCADE |
| Job → JobLogs | DELETE CASCADE |
| Worker → WorkerHeartbeats | DELETE CASCADE |
| Job → DeadLetterQueue | No cascade (preserve for audit) |

### Normalization
- **3NF**: All tables are in 3rd Normal Form. No transitive dependencies.
- **RetryPolicy** is extracted into its own table to avoid repeating strategy config across jobs and queues.
- **JobExecution** separates each attempt's metrics from the job itself (one job : many executions).

### Performance Indexes
| Table | Index | Query Pattern |
|---|---|---|
| jobs | `(status, run_at)` | Worker poll query |
| jobs | `(status, priority, run_at)` | Priority-ordered polling |
| jobs | `(queue_id, status)` | Queue statistics |
| jobs | `(batch_id)` | Batch job lookup |
| job_executions | `(job_id)` | Job execution history |
| job_executions | `(worker_id)` | Worker execution history |
| job_executions | `(status, started_at)` | Throughput metrics |
| job_logs | `(job_id, timestamp)` | Ordered log retrieval |
| workers | `(status, last_heartbeat)` | Stale worker detection |
| worker_heartbeats | `(worker_id, timestamp)` | Historical heartbeats |
| dead_letter_queue | `(queue_id, failed_at)` | DLQ by queue |
