# Task-Mesh API Documentation

Base URL: `http://localhost:3001`

All endpoints return JSON in the format:
```json
{ "success": true, "data": {...} }
// or on error:
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

---

## Authentication

### Register
```
POST /api/auth/register
Body: { "email": "user@example.com", "password": "password123", "name": "John Doe" }
Response: { "user": {...}, "token": "eyJ..." }
```

### Login
```
POST /api/auth/login
Body: { "email": "user@example.com", "password": "password123" }
Response: { "user": {...}, "token": "eyJ..." }
```

### Get Current User
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

---

## Projects

All project endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create a project |
| GET | /api/projects/:id | Get project details |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project (cascades) |
| POST | /api/projects/:id/rotate-key | Rotate API key |

### Create Project
```
POST /api/projects
Body: { "name": "my-service", "description": "Optional" }
Response: { ...project, "apiKey": "tmk_..." }  // Key shown once!
```

---

## Queues

Queues are scoped to projects.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects/:projectId/queues | List queues |
| POST | /api/projects/:projectId/queues | Create queue |
| GET | /api/projects/:projectId/queues/:id | Get queue |
| PATCH | /api/projects/:projectId/queues/:id | Update queue |
| DELETE | /api/projects/:projectId/queues/:id | Delete queue |
| POST | /api/projects/:projectId/queues/:id/pause | Pause queue |
| POST | /api/projects/:projectId/queues/:id/resume | Resume queue |
| GET | /api/projects/:projectId/queues/:id/stats | Queue statistics |

### Create Queue
```
POST /api/projects/:projectId/queues
Body: {
  "name": "email-notifications",
  "priority": 5,           // 1–10, default 5
  "concurrencyLimit": 10,  // max concurrent jobs
  "rateLimitPerMin": 60,   // optional rate limit
  "retryPolicyId": "uuid"  // optional
}
```

---

## Jobs

Accepts both `Authorization: Bearer <token>` (dashboard) and `X-Api-Key: tmk_...` (API).

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/jobs | List jobs (paginated) |
| POST | /api/jobs | Create a job |
| POST | /api/jobs/batch | Create multiple jobs |
| GET | /api/jobs/:id | Get job with executions & logs |
| POST | /api/jobs/:id/cancel | Cancel a QUEUED/SCHEDULED job |
| POST | /api/jobs/:id/retry | Retry a FAILED/DLQ/CANCELLED job |

### Query Parameters (GET /api/jobs)
| Param | Description |
|-------|-------------|
| status | Filter by status (QUEUED, RUNNING, COMPLETED, FAILED, DLQ, ...) |
| queueId | Filter by queue |
| search | Search by job name |
| page | Page number (default: 1) |
| limit | Items per page (default: 20, max: 100) |

### Create Job
```
POST /api/jobs
Headers: X-Api-Key: tmk_...
Body: {
  "queueId": "uuid",
  "name": "send-email",
  "payload": { "to": "user@example.com" },
  "jobType": "IMMEDIATE",    // IMMEDIATE | DELAYED | SCHEDULED | CRON | BATCH
  "runAt": "2024-01-01T10:00:00Z",  // for DELAYED/SCHEDULED
  "cronExpression": "0 * * * *",    // for CRON
  "priority": 7,             // 1–10
  "maxRetries": 3,
  "idempotencyKey": "email-user-123-welcome",  // deduplication
  "dependsOnJobId": "uuid"   // workflow dependency
}
```

### Batch Create
```
POST /api/jobs/batch
Body: {
  "batchId": "optional-batch-id",
  "jobs": [
    { "queueId": "uuid", "name": "job-1", "payload": {} },
    { "queueId": "uuid", "name": "job-2", "payload": {} }
  ]
}
```

---

## Workers

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/workers | List all workers |
| POST | /api/workers/register | Register a new worker |
| POST | /api/workers/:id/heartbeat | Send heartbeat |
| POST | /api/workers/:id/deregister | Deregister worker |

---

## Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/metrics/overview | System health overview |
| GET | /api/metrics/throughput | Time-series throughput data |
| GET | /api/metrics/dlq | Dead Letter Queue entries |

---

## WebSocket

Connect to `ws://localhost:3001/ws` for real-time updates.

Messages sent by server:
```json
{ "type": "METRICS_UPDATE", "data": { "activeWorkers": 3, "queuedJobs": 12, "runningJobs": 5, "timestamp": "..." } }
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 422 | Request validation failed |
| CONFLICT | 409 | Duplicate resource |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
