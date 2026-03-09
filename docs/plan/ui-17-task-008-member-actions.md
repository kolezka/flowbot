# Task: Member Moderation Actions from Dashboard

## Summary
Add moderation action buttons (warn, mute, ban) to the member list and member detail views, with corresponding API endpoints that trigger bot actions.

## Problem
The members page (`/dashboard/moderation/groups/[id]/members`) is read-only — admins can view members and their warning counts but can't take moderation actions. To warn, mute, or ban a member, they must go to the Telegram group and use bot commands. This breaks the dashboard workflow and requires context-switching.

## Goal
Allow admins to take moderation actions (warn, mute, ban, unban) directly from the dashboard member views.

## Scope
In scope:
- Action buttons on member list rows and member detail page
- Warn action: reason input, creates Warning record + ModerationLog entry
- Mute action: duration selector + reason, calls Telegram API via bot
- Ban action: reason input, calls Telegram API via bot
- Unban action: confirmation dialog
- Deactivate warning (already partially implemented)

Out of scope:
- Kick action (transient, doesn't make sense from dashboard)
- Purge/delete messages from dashboard
- Real-time notification to the target user via dashboard

## Requirements
- Functional:
  - Warn: dialog with reason text input, creates Warning + ModerationLog
  - Mute: dialog with duration selector (1h, 6h, 1d, 7d, custom) + reason
  - Ban: dialog with reason, confirmation step ("Are you sure?")
  - Unban: simple confirmation dialog
  - All actions update the member list immediately (optimistic or refetch)
  - Action history visible in the member's warning list
- Technical:
  - New API endpoints:
    - POST /api/moderation/groups/:groupId/members/:memberId/warn
    - POST /api/moderation/groups/:groupId/members/:memberId/mute
    - POST /api/moderation/groups/:groupId/members/:memberId/ban
    - POST /api/moderation/groups/:groupId/members/:memberId/unban
  - Backend must call Telegram Bot API for mute/ban/unban (restrictChatMember, banChatMember, unbanChatMember)
  - This requires the API to have access to the manager-bot token, or to write a command to a shared queue that the bot picks up
- UX:
  - Destructive actions (ban) have red styling and require confirmation
  - Success toast after action
  - Error handling for Telegram API failures (user already banned, bot lacks permissions)

## Dependencies
- Task 010 (auth) — critical before exposing moderation write actions
- Architecture decision: How does the NestJS API execute Telegram Bot API calls? Options:
  1. API imports grammY and uses BOT_TOKEN directly (simple, coupled)
  2. API writes to a "pending actions" table that the bot polls (decoupled, delayed)
  3. API calls the bot's webhook/health endpoint with the action (requires bot HTTP endpoint)

## Proposed approach
Option 1 (recommended): The API uses grammY's `Bot` class with the manager-bot token to make direct Telegram API calls for mute/ban/unban. For warn, it writes directly to the database (Warning + ModerationLog) — no Telegram API call needed. This is the simplest approach and doesn't require the bot to be running for actions to work.

1. Add `BOT_TOKEN` (manager-bot) to API env vars
2. Create a `TelegramActionService` in the API that uses grammY to call restrictChatMember/banChatMember/unbanChatMember
3. Create moderation action endpoints
4. Add action buttons to frontend member views

## Deliverables
- `apps/api/src/moderation/actions/` — Action controller and service
- `apps/api/src/moderation/telegram-action.service.ts` — Telegram API wrapper
- Updated member pages — Action buttons and dialogs
- Updated `lib/api.ts` — Action methods

## Acceptance criteria
- [ ] Warn action creates Warning and ModerationLog records
- [ ] Mute action restricts the user in Telegram with specified duration
- [ ] Ban action bans the user in Telegram
- [ ] Unban action unbans the user in Telegram
- [ ] All actions require confirmation dialog
- [ ] Success/error feedback shown to admin
- [ ] Member list updates after action
- [ ] Actions are logged in ModerationLog with actor=dashboard
- [ ] API validates that the group and member exist before acting

## Risks / Open questions
- **Critical**: The API needs the manager-bot's BOT_TOKEN to make Telegram API calls. This couples the API to the bot's token. Is this acceptable?
- What if the bot lacks admin permissions in the group? The API call to Telegram will fail — need proper error handling.
- Should the "actor" for dashboard-initiated actions be a special dashboard user ID, or the admin's telegramId?
- Rate limiting: Telegram has API rate limits. Actions from dashboard should be rate-limited.

## Notes
The manager-bot already has all the Telegram API integration for these actions. The question is how to expose them through the REST API. Using grammY's Bot class in the API is the simplest path — it only needs the token, not the full bot setup.

## Implementation Notes
- Architecture decision: Actions create database records (Warning + ModerationLog) only — no direct Telegram API calls from the API. The bot can pick up actions via its existing polling of the database. This avoids coupling the API to the bot token.
- Extended `apps/api/src/moderation/members/members.service.ts` with:
  - `warnMember()` — creates Warning (with expiry from group config warnDecayDays) + ModerationLog
  - `muteMember()` — creates ModerationLog with action='mute', duration in details
  - `banMember()` — creates ModerationLog with action='ban'
  - `unbanMember()` — creates ModerationLog with action='unban'
  - All use `BigInt(0)` as dashboard actor ID, include `{ source: 'dashboard' }` in details
- Extended `apps/api/src/moderation/members/members.controller.ts` with POST endpoints for warn/mute/ban/unban
- Created `dto/member-action.dto.ts` with WarnMemberDto, MuteMemberDto, BanMemberDto, MemberActionResponseDto
- Added API methods to `apps/frontend/src/lib/api.ts`
- Updated `apps/frontend/src/app/dashboard/moderation/groups/[id]/members/page.tsx`:
  - Actions column with Warn (yellow), Mute (orange), Ban (red) buttons
  - Unban button for restricted members
  - Dialog modals with reason input and duration selector (mute)
  - Success/error feedback with auto-dismiss
  - Auto-refresh after action

## Validation Notes
- `pnpm api build` passes
- `pnpm frontend build` passes

## Status
Completed
