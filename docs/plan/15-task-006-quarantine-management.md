# Task: Quarantine Member Oversight

## Summary
Add a quarantine view to the group members page showing currently quarantined members with their status, expiry time, and manual release capability.

## Problem
When CAPTCHA or quarantine is enabled for a group, new members are automatically restricted (quarantined) until they verify. The GroupMember model tracks `isQuarantined` and `quarantineExpiresAt`, but there's no way to see which members are currently in quarantine, when their quarantine expires, or to manually release them. Moderators must wait for automatic expiry or use bot commands in the group.

## Goal
A quarantine section on the group members page showing quarantined members with status, countdown, and release action.

## Scope
In scope:
- API: Add quarantine filter to existing members endpoint (`?isQuarantined=true`)
- API: New endpoint `POST /api/moderation/groups/:groupId/members/:memberId/release` — removes quarantine
- Frontend: Quarantine tab/filter on group members page
- Frontend: Release button for quarantined members
- Frontend: Quarantine expiry countdown display

Out of scope:
- Manually quarantining a member from dashboard (quarantine is auto-applied on join)
- Extending quarantine duration
- CAPTCHA management from dashboard

## Requirements
- Functional:
  - Filter members by quarantine status
  - Show quarantine expiry time
  - Release member from quarantine (set isQuarantined=false)
  - Quarantine count badge in group detail
- Technical:
  - Extend members API with `isQuarantined` query parameter
  - New release endpoint sets isQuarantined=false and quarantineExpiresAt=null
  - Creates ModerationLog entry for release action
- UX:
  - Quarantine badge on members that are quarantined
  - Expiry shown as relative time ("expires in 2h 30m")
  - Release button with confirmation
  - Auto-refresh to update expiry countdown

## Dependencies
- Existing members controller and service
- GroupMember model already has isQuarantined and quarantineExpiresAt fields

## Proposed approach

### Backend
1. Add `isQuarantined` query parameter to members findAll method
2. Add `releaseMember(groupId, memberId)` to members service
3. Add `POST :memberId/release` endpoint to members controller

### Frontend
1. Add quarantine filter option to members page (tab or toggle)
2. Show quarantine badge and expiry for quarantined members
3. Add Release button with confirmation dialog
4. Add `releaseMember(groupId, memberId)` to ApiClient

## Deliverables
- Updated `apps/api/src/moderation/members/members.service.ts` — Quarantine filter + release method
- Updated `apps/api/src/moderation/members/members.controller.ts` — Query param + release endpoint
- Updated `apps/frontend/src/lib/api.ts` — releaseMember method
- Updated `apps/frontend/src/app/dashboard/moderation/groups/[id]/members/page.tsx` — Quarantine UI

## Acceptance criteria
- [ ] API: Members endpoint supports isQuarantined filter
- [ ] API: Release endpoint removes quarantine and creates log entry
- [ ] Frontend: Quarantine filter shows only quarantined members
- [ ] Frontend: Quarantine badge visible on quarantined members
- [ ] Frontend: Expiry time displayed as relative countdown
- [ ] Frontend: Release button with confirmation
- [ ] Frontend: Member list refreshes after release
- [ ] Both builds pass

## Risks / Open questions
- Does releasing a member from quarantine via the database also restore their Telegram permissions? The bot would need to call `restrictChatMember` to actually remove restrictions in Telegram. Without that, the DB says "not quarantined" but Telegram still restricts the user. This is the same limitation as the existing moderation actions (warn/mute/ban from dashboard create DB records but don't call Telegram API).
- Should we show a warning that releasing from quarantine only updates the database, not Telegram restrictions?

## Notes
GroupMember fields: isQuarantined (Boolean, default false), quarantineExpiresAt (DateTime?, nullable). The manager-bot's quarantine middleware checks these fields to determine if a member should have restricted permissions.
