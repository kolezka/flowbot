# Analytics — Architecture Spec

## Overview

Group analytics tracks community health metrics over time: member growth, message volume, spam incidents, moderation actions, and engagement trends.

Data is collected by manager-bot, stored in PostgreSQL, served by the API, and visualized in the dashboard.

## Data Collection

### GroupAnalyticsSnapshot (Prisma Model)
```prisma
model GroupAnalyticsSnapshot {
  id              String   @id @default(cuid())
  groupId         String
  group           ManagedGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  date            DateTime @db.Date  // one row per group per day
  memberCount     Int      @default(0)
  newMembers      Int      @default(0)
  leftMembers     Int      @default(0)
  messageCount    Int      @default(0)
  commandCount    Int      @default(0)
  spamDetected    Int      @default(0)
  linksBlocked    Int      @default(0)
  warningsIssued  Int      @default(0)
  mutesIssued     Int      @default(0)
  bansIssued      Int      @default(0)
  deletedMessages Int      @default(0)
  createdAt       DateTime @default(now())

  @@unique([groupId, date])
  @@index([groupId, date])
}
```

### Collection Strategy

**Real-time counters** (in-memory, flushed periodically):
- manager-bot maintains per-group counters in memory (Map<chatId, DailyCounters>)
- Flush to database every 5 minutes via a periodic timer
- On graceful shutdown, flush remaining counters

**Daily snapshots** (cron-like):
- At midnight UTC (or configurable), compute daily totals from:
  - ModerationLog entries for the day
  - GroupMember join/leave counts
  - In-memory counter flush
- Store as GroupAnalyticsSnapshot row

**Member count**:
- On each group-data middleware pass, update member count if changed
- Track joins/leaves via chat_member events (already captured by MB-18)

## Manager-Bot Service

### AnalyticsService (`apps/manager-bot/src/services/analytics.ts`)

```typescript
class AnalyticsService {
  private counters: Map<string, DailyCounters>  // chatId → counters
  private flushInterval: NodeJS.Timeout

  // Called by middlewares/features as events occur
  incrementMessage(chatId: bigint): void
  incrementSpam(chatId: bigint): void
  incrementWarning(chatId: bigint): void
  incrementMute(chatId: bigint): void
  incrementBan(chatId: bigint): void
  incrementLinkBlocked(chatId: bigint): void
  incrementDeletedMessage(chatId: bigint): void
  recordMemberJoin(chatId: bigint): void
  recordMemberLeave(chatId: bigint): void

  // Periodic flush
  start(): void       // start 5-min flush interval
  stop(): Promise<void>  // flush + clear interval
  flush(): Promise<void> // upsert counters to DB
}
```

### /stats Command (`apps/manager-bot/src/bot/features/stats.ts`)

```
/stats — Show group statistics for today/this week
/stats 7d — Last 7 days summary
/stats 30d — Last 30 days summary
```

Output format:
```
📊 Group Stats (last 7 days)
Members: 142 (+8, -2)
Messages: 1,247
Spam blocked: 23
Warnings: 5
Mutes: 2
Bans: 0
```

## API Layer

### AnalyticsController (`apps/api/src/analytics/`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/groups/:id` | Time series data for a group |
| GET | `/api/analytics/groups/:id/summary` | Aggregated summary (7d, 30d, all-time) |
| GET | `/api/analytics/overview` | Cross-group overview for dashboard home |

Query parameters:
- `from`: ISO date (default: 30 days ago)
- `to`: ISO date (default: today)
- `granularity`: `day` | `week` | `month` (default: day)

Response format:
```json
{
  "groupId": "...",
  "from": "2026-02-07",
  "to": "2026-03-09",
  "granularity": "day",
  "series": [
    {
      "date": "2026-03-08",
      "memberCount": 142,
      "newMembers": 3,
      "messageCount": 178,
      "spamDetected": 2,
      "warningsIssued": 1,
      "mutesIssued": 0,
      "bansIssued": 0
    }
  ]
}
```

## Frontend Layer

### Analytics Dashboard Page (`app/dashboard/moderation/analytics/`)

Components:
- **MemberGrowthChart** — line chart: total members over time, with join/leave overlay
- **ModerationActivityChart** — stacked bar: warnings, mutes, bans per day
- **SpamTrendChart** — line chart: spam detected + links blocked
- **EngagementChart** — line chart: messages per day
- **GroupHealthCard** — summary KPIs: member count, growth rate, spam rate, moderation rate

Chart library: Use lightweight charting (recharts or chart.js via react-chartjs-2) — add as frontend dependency.

### Overview Page Integration

The main `/dashboard/moderation` page shows:
- Total managed groups (active/inactive)
- Aggregate stats across all groups (last 24h)
- Top 5 most active groups
- Top 5 groups with most moderation actions
- Recent moderation log entries (last 10)

## Memory Considerations

- In-memory counters are lightweight: ~100 bytes per group per day
- Flush every 5 minutes prevents data loss on crash (max 5 min of counter data lost)
- GroupAnalyticsSnapshot grows at: 1 row × N groups × days → prune after 365 days
- Add cleanup task: delete snapshots older than `ANALYTICS_RETENTION_DAYS` (default 365)
