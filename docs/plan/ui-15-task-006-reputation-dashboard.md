# Task: Reputation Leaderboard and Details Dashboard

## Summary
Build a reputation dashboard page showing community reputation leaderboard, score breakdowns, and trends.

## Problem
The reputation system calculates scores (message activity, tenure, warning penalties, moderation bonuses) but the only way to check scores is via bot command (`/reputation @user`). There's no overview of community health, no leaderboard, and no way to identify at-risk or high-value community members from the dashboard. The API endpoint `GET /api/reputation/:telegramId` exists but returns individual scores only.

## Goal
A reputation dashboard with leaderboard, score breakdown visualization, and integration with the existing user profile page.

## Scope
In scope:
- Dashboard page: `/dashboard/community/reputation`
- Leaderboard: top N members by reputation score
- Score breakdown display (message factor, tenure factor, warning penalty, moderation bonus)
- Link to unified user profile from leaderboard entries
- API endpoint for leaderboard (new)

Out of scope:
- Modifying reputation scores from the dashboard
- Reputation history/trends over time (no historical data stored)
- Gamification features (badges, levels)

## Requirements
- Functional:
  - Leaderboard showing top 50 members by total score
  - Each entry: rank, username/name, total score, breakdown bar
  - Filter by group (show members of specific group)
  - Score breakdown tooltip or expandable row
  - Quick stats: average score, median, total scored members
  - Link to user profile page
- Technical:
  - New API endpoint: GET /api/reputation/leaderboard?limit=50&groupId=optional
  - Extend existing reputation service to support leaderboard query
  - Frontend components for score visualization
- UX:
  - Color-coded scores (green = high, yellow = medium, red = low/negative)
  - Bar chart showing factor breakdown per user
  - Responsive table

## Dependencies
- Task 001 (navigation) — needs "Community" section in sidebar
- Existing: ReputationScore model, GET /api/reputation/:telegramId endpoint

## Proposed approach

### Backend
1. Add `getLeaderboard(limit, groupId?)` to reputation service
2. New endpoint: GET /api/reputation/leaderboard
3. Join with GroupMember to filter by group
4. Join with UserIdentity or GroupMember for display names

### Frontend
1. Create `/dashboard/community/reputation/page.tsx`
2. Leaderboard table with rank, user info, score, breakdown
3. Group filter dropdown
4. Score visualization using inline colored bars (no chart library needed)

## Deliverables
- Extended `apps/api/src/reputation/reputation.controller.ts` — Leaderboard endpoint
- `apps/frontend/src/app/dashboard/community/reputation/page.tsx`
- Updated `lib/api.ts` — Leaderboard interfaces
- Updated navigation — "Community" section

## Acceptance criteria
- [ ] API: Leaderboard returns top N members sorted by score
- [ ] API: Group filter works
- [ ] Frontend: Leaderboard table renders with rank, name, score
- [ ] Frontend: Score breakdown visible per entry
- [ ] Frontend: Group filter dropdown works
- [ ] Frontend: Click on member links to unified profile
- [ ] Frontend: Color-coded score indicators

## Risks / Open questions
- ReputationScore only stores telegramId — need to resolve to username/firstName for display. Join path: ReputationScore.telegramId → GroupMember.telegramId or UserIdentity.telegramId.
- How many ReputationScore records exist? If thousands, pagination is needed for the leaderboard.
- Should negative scores be shown publicly or filtered?

## Notes
ReputationScore model: id, telegramId (BigInt unique), totalScore, messageFactor, tenureFactor, warningPenalty, moderationBonus, lastCalculated, createdAt, updatedAt.

## Implementation Notes
- Extended existing `apps/api/src/reputation/` module:
  - Added `GET /api/reputation/leaderboard?limit=50&groupId=optional` endpoint
  - Added `getLeaderboard()` service method: queries ReputationScore ordered by totalScore desc, joins with User for display names, supports groupId filter via GroupMember lookup, computes average/median stats
  - Created `dto/leaderboard-entry.dto.ts` and `dto/leaderboard-response.dto.ts`
- Added interfaces and API method to `apps/frontend/src/lib/api.ts`
- Created `apps/frontend/src/app/dashboard/community/reputation/page.tsx`:
  - Stats cards (total scored, average, median)
  - Group filter dropdown
  - Leaderboard table with rank, user (linked to profile), color-coded score (green/yellow/red), inline colored bar segments for factor breakdown
- Added "Community" section with Heart icon and "Reputation" entry with Trophy icon to sidebar

## Validation Notes
- `pnpm api build` passes
- `pnpm frontend build` passes with `/dashboard/community/reputation` route

## Status
Completed
