# Task: Role and Permission Management UI

## Summary
Build a web UI for managing moderator roles within groups, allowing admins to promote/demote members without using bot commands.

## Problem
Managing moderator roles currently requires being in the Telegram group and using bot commands (`/mod @user`, `/unmod @user`, `/mods`). Group admins who manage multiple groups must context-switch between the dashboard and Telegram for each role change. The GroupMember model has a `role` field (member/moderator/admin) but there are no API endpoints to change it from the dashboard.

## Goal
Enable role management from the group members page, with promote/demote actions and a moderators overview.

## Scope
In scope:
- New API endpoint: `PATCH /api/moderation/groups/:groupId/members/:memberId/role` — change member role
- Frontend: Role change buttons on group members page (promote to moderator / demote to member)
- Frontend: Visual indicator of current role (badges)
- Frontend: Moderators count in group detail page

Out of scope:
- Changing Telegram admin status (this is a Telegram API operation, not a bot database operation)
- Creating new permission levels beyond member/moderator
- Per-command permission configuration from UI

## Requirements
- Functional:
  - Promote member to moderator
  - Demote moderator to member
  - View current role for each member
  - Moderators are highlighted in member list
- Technical:
  - New API endpoint on members controller
  - Role change DTO with validation (only "member" and "moderator" allowed; "admin" is read-only from Telegram)
  - Update member role in GroupMember table
  - Create ModerationLog entry for role changes
- UX:
  - Role displayed as colored badge (admin=purple, moderator=blue, member=gray)
  - Promote/demote button contextual to current role
  - Confirmation dialog for role changes
  - Cannot change admin roles (they come from Telegram)

## Dependencies
- Existing members controller at `apps/api/src/moderation/members/members.controller.ts`
- Existing members service at `apps/api/src/moderation/members/members.service.ts`
- Existing group members page at `apps/frontend/src/app/dashboard/moderation/groups/[id]/members/page.tsx`

## Proposed approach

### Backend
1. Create `UpdateMemberRoleDto` with role field (enum: "member" | "moderator")
2. Add `updateRole(groupId, memberId, role)` to members service — validates member exists, role is valid, creates ModerationLog entry
3. Add `PATCH :memberId/role` endpoint to members controller

### Frontend
1. Add `updateMemberRole(groupId, memberId, role)` to ApiClient
2. Add role badge rendering in members table (already shows role text, enhance with color)
3. Add Promote/Demote button next to each member (not shown for admins/creators)
4. Confirmation dialog before role change
5. Refresh member list after role change

## Deliverables
- New `apps/api/src/moderation/members/dto/update-member-role.dto.ts`
- Updated `apps/api/src/moderation/members/members.controller.ts` — Role endpoint
- Updated `apps/api/src/moderation/members/members.service.ts` — Role update method
- Updated `apps/frontend/src/lib/api.ts` — updateMemberRole method
- Updated `apps/frontend/src/app/dashboard/moderation/groups/[id]/members/page.tsx` — Role UI

## Acceptance criteria
- [ ] API: PATCH endpoint changes member role
- [ ] API: Only "member" and "moderator" roles accepted (400 for others)
- [ ] API: Role change creates ModerationLog entry
- [ ] API: Cannot change role of admin/creator members
- [ ] Frontend: Role badges show with appropriate colors
- [ ] Frontend: Promote button shown for members, Demote button shown for moderators
- [ ] Frontend: No role change buttons for admins/creators
- [ ] Frontend: Confirmation dialog before role change
- [ ] Frontend: Member list refreshes after role change
- [ ] Both builds pass

## Risks / Open questions
- The manager-bot checks `GroupMember.role` from the database for permission decisions. Changing the role via API will immediately affect the bot's permission checks — this is the desired behavior.
- Should role changes from the dashboard be distinguishable from bot command role changes in the ModerationLog? Recommendation: yes, include `{ source: "dashboard" }` in details.

## Notes
GroupMember model has role field with values: "member", "moderator", "admin". The "admin" role is synced from Telegram group admin status. The bot's permission middleware checks GroupMember.role to authorize commands. Changing role in DB is sufficient — no Telegram API call needed.
