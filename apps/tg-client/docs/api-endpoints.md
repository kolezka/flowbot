# Automation Jobs API (apps/api)

API endpoints for creating and managing automation jobs that are consumed by `tg-client`. These endpoints are served by the NestJS API at `/api/automation/jobs`.

Jobs use a producer/consumer pattern: the API creates jobs (producer), and `tg-client` polls and executes them (consumer).

## Data Model

### AutomationJob

| Field        | Type        | Default     | Description                          |
|-------------|-------------|-------------|--------------------------------------|
| id          | string      | cuid()      | Unique identifier                    |
| type        | JobType     | —           | Action type to execute               |
| status      | JobStatus   | `PENDING`   | Current job status                   |
| payload     | JSON        | —           | Action-specific payload (see below)  |
| result      | JSON?       | null        | Execution result set by tg-client    |
| attempts    | int         | 0           | Number of execution attempts so far  |
| maxAttempts | int         | 3           | Maximum retry attempts               |
| claimedAt   | DateTime?   | null        | When tg-client claimed the job       |
| completedAt | DateTime?   | null        | When the job completed successfully  |
| failedAt    | DateTime?   | null        | When the job permanently failed      |
| errorMsg    | string?     | null        | Error message on failure             |
| createdAt   | DateTime    | now()       | Record creation timestamp            |
| updatedAt   | DateTime    | auto        | Last update timestamp                |

### Enums

```
JobType: SEND_MESSAGE | FORWARD_MESSAGE
JobStatus: PENDING | CLAIMED | COMPLETED | FAILED
```

---

## Endpoints

### POST /api/automation/jobs

Create a new automation job.

**Request Body:**

```json
{
  "type": "SEND_MESSAGE" | "FORWARD_MESSAGE",
  "payload": { ... },
  "maxAttempts": 3
}
```

- `type` (required) — One of the `JobType` enum values.
- `payload` (required) — JSON object matching the schema for the given `type` (see [Payload Schemas](#payload-schemas)).
- `maxAttempts` (optional, default: `3`) — Maximum number of execution attempts before the job is marked as `FAILED`.

**Response:** `201 Created`

```json
{
  "id": "clx1abc2def",
  "type": "SEND_MESSAGE",
  "status": "PENDING",
  "payload": {
    "peer": "-1001234567890",
    "text": "Hello from automation"
  },
  "result": null,
  "attempts": 0,
  "maxAttempts": 3,
  "claimedAt": null,
  "completedAt": null,
  "failedAt": null,
  "errorMsg": null,
  "createdAt": "2026-03-09T12:00:00.000Z",
  "updatedAt": "2026-03-09T12:00:00.000Z"
}
```

**Errors:**
- `400` — Invalid payload or unknown job type.

---

### GET /api/automation/jobs

List automation jobs with optional filtering and pagination.

**Query Parameters:**

| Param   | Type      | Default | Description                              |
|---------|-----------|---------|------------------------------------------|
| status  | JobStatus | —       | Filter by job status                     |
| type    | JobType   | —       | Filter by job type                       |
| limit   | number    | 20      | Maximum number of results (max 100)      |
| offset  | number    | 0       | Number of results to skip for pagination |

**Response:** `200 OK`

```json
{
  "items": [
    {
      "id": "clx1abc2def",
      "type": "SEND_MESSAGE",
      "status": "COMPLETED",
      "payload": { "peer": "-1001234567890", "text": "Hello" },
      "result": { "messageId": 42 },
      "attempts": 1,
      "maxAttempts": 3,
      "claimedAt": "2026-03-09T12:00:01.000Z",
      "completedAt": "2026-03-09T12:00:02.000Z",
      "failedAt": null,
      "errorMsg": null,
      "createdAt": "2026-03-09T12:00:00.000Z",
      "updatedAt": "2026-03-09T12:00:02.000Z"
    }
  ],
  "total": 1
}
```

---

### GET /api/automation/jobs/:id

Get a single job by ID.

**Path Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| id    | string | The job's cuid ID |

**Response:** `200 OK`

Returns the full job object (same shape as items in the list response).

**Errors:**
- `404` — Job not found.

---

### DELETE /api/automation/jobs/:id

Cancel a pending job. Sets the job status to `FAILED` with an error message indicating cancellation. Only jobs with status `PENDING` can be cancelled.

**Path Parameters:**

| Param | Type   | Description       |
|-------|--------|-------------------|
| id    | string | The job's cuid ID |

**Response:** `200 OK`

```json
{
  "id": "clx1abc2def",
  "type": "SEND_MESSAGE",
  "status": "FAILED",
  "payload": { "peer": "-1001234567890", "text": "Hello" },
  "result": null,
  "attempts": 0,
  "maxAttempts": 3,
  "claimedAt": null,
  "completedAt": null,
  "failedAt": "2026-03-09T12:05:00.000Z",
  "errorMsg": "Cancelled via API",
  "createdAt": "2026-03-09T12:00:00.000Z",
  "updatedAt": "2026-03-09T12:05:00.000Z"
}
```

**Errors:**
- `404` — Job not found.
- `409` — Job is not in `PENDING` status (already claimed, completed, or failed).

---

## Payload Schemas

### SEND_MESSAGE

Send a text message to a Telegram peer (chat, group, or channel).

```json
{
  "peer": "-1001234567890",
  "text": "Message content here",
  "parseMode": "HTML",
  "replyToMsgId": 123,
  "silent": false
}
```

| Field        | Type    | Required | Description                                          |
|-------------|---------|----------|------------------------------------------------------|
| peer        | string  | yes      | Telegram peer identifier (chat ID or username)       |
| text        | string  | yes      | Message text content                                 |
| parseMode   | string  | no       | Parse mode for formatting (`HTML`, `MarkdownV2`)     |
| replyToMsgId| number  | no       | Message ID to reply to                               |
| silent      | boolean | no       | Send without notification sound                      |

### FORWARD_MESSAGE

Forward one or more messages from one peer to another.

```json
{
  "fromPeer": "-1001234567890",
  "toPeer": "-1009876543210",
  "messageIds": [100, 101, 102],
  "silent": false,
  "dropAuthor": false
}
```

| Field      | Type     | Required | Description                                        |
|-----------|----------|----------|----------------------------------------------------|
| fromPeer  | string   | yes      | Source peer to forward messages from               |
| toPeer    | string   | yes      | Destination peer to forward messages to            |
| messageIds| number[] | yes      | Array of message IDs to forward                    |
| silent    | boolean  | no       | Forward without notification sound                 |
| dropAuthor| boolean  | no       | Hide the original author (anonymous forwarding)    |
