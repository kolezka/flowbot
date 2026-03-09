# Task: Scheduled Messages Management UI

## Summary
Build a dashboard page for viewing, creating, and canceling scheduled messages, with a corresponding API module in the backend.

## Problem
Scheduled messages are currently managed only through bot commands (`/remind`, `/schedule`, `/schedule list`, `/schedule cancel`). Admins can't see all scheduled messages across groups in one place, can't easily compose long messages, and have no calendar/timeline view. The ScheduledMessage Prisma model exists but has no API endpoints.

## Goal
A web-based scheduled messages management interface with cross-group visibility, message composer, and cancel functionality.

## Scope
In scope:
- New NestJS API module: `apps/api/src/moderation/scheduled-messages/`
- Dashboard page: `/dashboard/moderation/scheduled-messages`
- List view: all scheduled messages with group filter, sent/pending filter
- Create form: group selector, message text, send date/time picker
- Cancel action: mark as canceled (or delete)
- Pagination

Out of scope:
- Recurring/cron scheduled messages (only one-time send)
- Rich media (images, videos) in messages
- Preview rendering of Telegram formatting

## Requirements
- Functional:
  - List all scheduled messages across groups with columns: group name, message preview (truncated), send date, status (pending/sent/canceled)
  - Filter by group, filter by status
  - Create new scheduled message: select group (dropdown of managed groups), message text (textarea), send at (datetime picker)
  - Cancel pending message (confirm dialog)
  - Sort by send date (ascending = upcoming first)
- Technical:
  - New API endpoints: GET /api/moderation/scheduled-messages, POST /api/moderation/scheduled-messages, DELETE /api/moderation/scheduled-messages/:id
  - DTOs with class-validator
  - Frontend API client extensions
- UX:
  - Datetime picker should default to tomorrow at current hour
  - Message textarea should support multi-line
  - Past messages (sent=true) shown in a "History" tab

## Dependencies
- Task 010 (auth) — should be in place before adding write operations
- Existing: ScheduledMessage Prisma model, ManagedGroup model for group selection

## Proposed approach

### Backend (apps/api)
1. Create `src/moderation/scheduled-messages/` module with:
   - `scheduled-messages.controller.ts` — GET (list), POST (create), DELETE (cancel)
   - `scheduled-messages.service.ts` — Prisma queries
   - `dto/` — CreateScheduledMessageDto, QueryScheduledMessagesDto
2. Register in moderation module

### Frontend (apps/frontend)
1. Create `src/app/dashboard/moderation/scheduled-messages/page.tsx`
2. Two tabs: "Upcoming" (sent=false, sendAt > now) and "History" (sent=true or past)
3. Create dialog with group selector + textarea + datetime input
4. Cancel button with confirmation dialog
5. Add nav link in moderation layout

## Deliverables
- `apps/api/src/moderation/scheduled-messages/` — Full NestJS module
- `apps/frontend/src/app/dashboard/moderation/scheduled-messages/page.tsx` — Dashboard page
- Updated `apps/frontend/src/lib/api.ts` — ScheduledMessage interfaces and methods
- Updated moderation layout nav — Add "Schedule" link

## Acceptance criteria
- [ ] API: GET returns paginated scheduled messages with group info
- [ ] API: POST creates a scheduled message with valid future date
- [ ] API: POST rejects past dates
- [ ] API: DELETE marks message as canceled or removes it
- [ ] Frontend: List shows all scheduled messages grouped by upcoming/history
- [ ] Frontend: Create dialog works with group selector and datetime
- [ ] Frontend: Cancel action has confirmation dialog
- [ ] Frontend: Filter by group works
- [ ] Frontend: Page is accessible from moderation navigation

## Risks / Open questions
- The ScheduledMessage model uses `BigInt` for chatId and createdBy. Frontend needs BigInt serialization handling (JSON.stringify doesn't handle BigInt by default).
- Should cancellation delete the record or set a `canceled` status field? Current model has `sent` boolean but no `canceled` state.
- Does the manager-bot scheduler service pick up messages created via API? Need to verify — the scheduler polls the database, so it should work.

## Notes
ScheduledMessage model: id, groupId, chatId (BigInt), text, createdBy (BigInt), sendAt (DateTime), sent (Boolean), sentAt (DateTime?), createdAt. The manager-bot scheduler service polls for unsent messages where sendAt <= now.

## Implementation Notes
- Created full NestJS API module at `apps/api/src/moderation/scheduled-messages/`:
  - `scheduled-messages.controller.ts` — GET / (paginated list, groupId/sent filters), POST / (create), DELETE /:id (remove)
  - `scheduled-messages.service.ts` — Prisma queries with BigInt→string mapping, future-date validation, group lookup for chatId
  - `dto/scheduled-message.dto.ts` — ScheduledMessageDto, ScheduledMessageListResponseDto, CreateScheduledMessageDto with class-validator
  - `scheduled-messages.module.ts` — NestJS module
- Registered in `apps/api/src/moderation/moderation.module.ts` (imports + exports)
- Added to `apps/frontend/src/lib/api.ts`: ScheduledMessage/ScheduledMessageListResponse interfaces, getScheduledMessages/createScheduledMessage/deleteScheduledMessage methods
- Created `apps/frontend/src/app/dashboard/moderation/scheduled-messages/page.tsx`:
  - Two tabs: Upcoming (sent=false) and History (sent=true)
  - Table with group, message preview (truncated), send at, status badge, actions
  - Group filter dropdown
  - Create form with group selector, message textarea, datetime-local input (default: tomorrow)
  - Delete confirmation inline (Yes/No buttons)
  - Pagination controls
- Added "Scheduled" nav entry with Calendar icon to sidebar under Moderation section

## Validation Notes
- `pnpm api build` passes (webpack compiled successfully)
- `pnpm frontend build` passes with `/dashboard/moderation/scheduled-messages` route included
- All existing routes unaffected

## Status
Completed
