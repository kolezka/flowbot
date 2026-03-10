# Task: Broadcast Edit/Delete/Retry Lifecycle

## Summary
Add edit, delete, and retry capabilities for broadcast messages, completing the broadcast lifecycle management.

## Problem
Broadcasts are currently create-and-forget. Once a broadcast is created via the dashboard, it cannot be modified (if pending), cancelled, deleted, or retried (if failed). If an admin makes a typo in a broadcast message, they cannot fix it — they must create a new one. Failed broadcasts have no retry mechanism from the UI.

## Goal
Complete CRUD lifecycle for broadcasts: create (exists), read (exists), update (new), delete (new), retry failed (new).

## Scope
In scope:
- API: PATCH `/api/broadcast/:id` — edit pending broadcast (text, targetChatIds)
- API: DELETE `/api/broadcast/:id` — delete/cancel broadcast
- API: POST `/api/broadcast/:id/retry` — retry a failed broadcast
- Frontend: Edit button on pending broadcasts
- Frontend: Delete button with confirmation on all broadcasts
- Frontend: Retry button on failed broadcasts
- Frontend: Status-aware action visibility (pending: edit/delete; failed: retry/delete; completed: delete only)

Out of scope:
- Editing completed (delivered) broadcasts
- Broadcast scheduling (use scheduled messages for timed delivery)
- Broadcast analytics (open rates, delivery confirmation per recipient)

## Requirements
- Functional:
  - Edit: Only PENDING broadcasts can be edited. Changes text and/or targetChatIds.
  - Delete: Any broadcast can be deleted. PENDING ones are cancelled. COMPLETED/FAILED ones are removed from history.
  - Retry: Only FAILED broadcasts can be retried. Creates a new broadcast job with the same payload.
  - Status checks: API enforces status-based constraints (400 if editing non-pending, etc.)
- Technical:
  - New API endpoints on existing broadcast controller
  - Update existing broadcast service with update/delete/retry methods
  - Update frontend API client and broadcast page
- UX:
  - Status-dependent action buttons (don't show Edit for completed broadcasts)
  - Inline edit form (expand row to show edit fields)
  - Delete confirmation dialog
  - Success/error feedback

## Dependencies
- Existing broadcast controller at `apps/api/src/broadcast/broadcast.controller.ts`
- Existing broadcast service at `apps/api/src/broadcast/broadcast.service.ts`
- Existing broadcast page at `apps/frontend/src/app/dashboard/broadcast/page.tsx`

## Proposed approach

### Backend
1. Add `UpdateBroadcastDto` (text?, targetChatIds?)
2. Add `update(id, dto)` — validates status=PENDING, updates fields
3. Add `remove(id)` — deletes broadcast record
4. Add `retry(id)` — validates status=FAILED, creates new broadcast with same payload + status=PENDING
5. Add PATCH, DELETE, POST /:id/retry endpoints to controller

### Frontend
1. Add `updateBroadcast`, `deleteBroadcast`, `retryBroadcast` methods to ApiClient
2. Update broadcast page: add Edit/Delete/Retry buttons per row based on status
3. Edit: expand row with inline form pre-filled with current values
4. Delete: inline confirmation
5. Retry: direct action button

## Deliverables
- Updated `apps/api/src/broadcast/broadcast.controller.ts` — PATCH, DELETE, POST retry endpoints
- Updated `apps/api/src/broadcast/broadcast.service.ts` — update, remove, retry methods
- New `apps/api/src/broadcast/dto/update-broadcast.dto.ts`
- Updated `apps/frontend/src/lib/api.ts` — New broadcast methods
- Updated `apps/frontend/src/app/dashboard/broadcast/page.tsx` — Edit/Delete/Retry UI

## Acceptance criteria
- [ ] PATCH endpoint updates pending broadcasts only (400 for non-pending)
- [ ] DELETE endpoint removes any broadcast
- [ ] Retry endpoint creates new broadcast from failed broadcast's payload
- [ ] Frontend shows Edit button only for PENDING broadcasts
- [ ] Frontend shows Retry button only for FAILED broadcasts
- [ ] Frontend shows Delete button for all broadcasts
- [ ] Edit form pre-fills with current values
- [ ] Delete has confirmation dialog
- [ ] Success/error feedback displayed
- [ ] Both builds pass

## Risks / Open questions
- What happens if a PENDING broadcast is being processed by the tg-client at the moment of edit/delete? Need to handle race condition — perhaps check status is still PENDING before updating.
- Should retry preserve the original broadcast record or create a new one? Recommendation: create new one with reference to original (or just copy payload).

## Notes
BroadcastMessage model: id, status (String — PENDING/COMPLETED/FAILED), text, targetChatIds (BigInt[]), results (Json?), createdAt, updatedAt. The broadcast controller is at `apps/api/src/broadcast/`.
