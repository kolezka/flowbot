# Dashboard Moderation — Architecture Spec

## Overview

Extend the existing NestJS API (`apps/api`) and Next.js dashboard (`apps/frontend`) with moderation management capabilities. This is the first time these apps are modified for manager-bot integration — all data comes from the shared Prisma schema.

## API Layer (`apps/api`)

### New Modules

#### ModerationModule (`src/moderation/`)
```
moderation/
├── moderation.module.ts
├── groups/
│   ├── groups.controller.ts      # /api/groups
│   ├── groups.service.ts
│   └── dto/
│       ├── group-response.dto.ts
│       └── update-config.dto.ts
├── logs/
│   ├── moderation-logs.controller.ts  # /api/moderation/logs
│   ├── moderation-logs.service.ts
│   └── dto/
│       └── log-query.dto.ts
├── warnings/
│   ├── warnings.controller.ts    # /api/warnings
│   ├── warnings.service.ts
│   └── dto/
│       └── warning-response.dto.ts
└── members/
    ├── members.controller.ts     # /api/groups/:id/members
    ├── members.service.ts
    └── dto/
        └── member-response.dto.ts
```

### Endpoints

#### Groups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups` | List all managed groups (paginated, filterable by isActive) |
| GET | `/api/groups/:id` | Group details with config and member count |
| PATCH | `/api/groups/:id/config` | Update group configuration |
| GET | `/api/groups/:id/members` | List group members (paginated, filterable by role) |

#### Moderation Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/moderation/logs` | Query logs with filters: groupId, targetId, action, dateFrom, dateTo, automated |
| GET | `/api/moderation/logs/stats` | Aggregated stats: actions per day, top actors, top targets |

#### Warnings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/warnings` | List warnings (filterable by groupId, memberId, isActive) |
| DELETE | `/api/warnings/:id` | Deactivate a warning (set isActive=false) |
| GET | `/api/warnings/stats` | Warning counts by group, escalation stats |

#### Broadcasts (cross-ref with XP tasks)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/broadcast` | Create broadcast AutomationJob |
| GET | `/api/broadcast` | List broadcasts with status |
| GET | `/api/broadcast/:id` | Broadcast details + delivery status |

### DTOs (class-validator, matching API conventions)

```typescript
// group-response.dto.ts
class GroupResponseDto {
  id: string
  chatId: string  // BigInt serialized as string
  title: string | null
  isActive: boolean
  memberCount: number
  warningCount: number
  joinedAt: Date
}

// log-query.dto.ts
class LogQueryDto {
  groupId?: string
  targetId?: string
  action?: string
  automated?: boolean
  dateFrom?: Date
  dateTo?: Date
  page?: number = 1
  limit?: number = 50
}
```

### Pagination

Follow existing API patterns. Return:
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
}
```

## Frontend Layer (`apps/frontend`)

### New Pages

```
app/dashboard/moderation/
├── page.tsx              # Overview: group count, recent actions, charts
├── groups/
│   ├── page.tsx          # Groups list table
│   └── [id]/
│       ├── page.tsx      # Group detail with config editor
│       └── members/
│           └── page.tsx  # Members list with warnings
├── logs/
│   └── page.tsx          # Filterable moderation log viewer
├── warnings/
│   └── page.tsx          # Active warnings across all groups
└── broadcast/
    ├── page.tsx          # Broadcast list
    └── new/
        └── page.tsx      # Broadcast composer
```

### Components

- `GroupCard` — group summary with quick stats
- `ConfigEditor` — form for GroupConfig fields with validation
- `ModerationLogTable` — sortable, filterable log table
- `WarningBadge` — visual warning count indicator
- `BroadcastComposer` — text editor + group selector + schedule picker

### API Client Extensions

Add to `lib/api.ts`:
```typescript
// Groups
getGroups(params?: GroupQuery): Promise<PaginatedResponse<Group>>
getGroup(id: string): Promise<Group>
updateGroupConfig(id: string, config: Partial<GroupConfig>): Promise<GroupConfig>
getGroupMembers(id: string, params?: MemberQuery): Promise<PaginatedResponse<Member>>

// Moderation Logs
getModerationLogs(params?: LogQuery): Promise<PaginatedResponse<ModerationLog>>
getModerationLogStats(params?: StatsQuery): Promise<ModerationStats>

// Warnings
getWarnings(params?: WarningQuery): Promise<PaginatedResponse<Warning>>
deactivateWarning(id: string): Promise<void>

// Broadcast
createBroadcast(payload: BroadcastPayload): Promise<AutomationJob>
getBroadcasts(): Promise<PaginatedResponse<AutomationJob>>
```

## Design Patterns

- Follow existing frontend patterns (Radix UI, Tailwind CSS 4)
- Use existing dashboard layout and sidebar navigation
- Add "Moderation" section to sidebar with sub-items
- All BigInt fields serialized as strings in API responses
- Dates in ISO 8601 format
