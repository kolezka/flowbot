# Task: Dashboard Home Page Redesign

## Summary
Replace the current `/dashboard` page (which is just the users list) with a proper overview dashboard showing key metrics, recent activity, and quick links across all system areas.

## Problem
The main dashboard page at `/dashboard` shows only the e-commerce users list. When an admin logs in, they see a users table instead of an at-a-glance overview of system health. There's no single place to see: total users, active groups, recent moderation actions, automation job status, and pending scheduled messages. Admins must navigate to individual sections to assess overall system state.

## Goal
A proper dashboard home page with KPI cards, recent activity feeds, and quick navigation to key areas.

## Scope
In scope:
- Redesign `/dashboard` page as an overview dashboard
- KPI cards row: total users, active groups, messages today, warnings today, pending jobs
- Recent moderation activity feed (last 10 actions)
- Quick group health summary (groups with highest spam/warning rates)
- Automation status summary (pending jobs, failed jobs, last successful action)
- Quick links to common actions (view groups, manage products, check analytics)

Out of scope:
- The users list still needs to be accessible — move it to `/dashboard/users` (new route)
- Real-time data (polling is acceptable)
- Customizable dashboard layouts/widgets

## Requirements
- Functional:
  - KPI cards: total users (from `/api/users/stats`), active groups + total members (from `/api/analytics/overview`), pending jobs (from `/api/automation/jobs/stats`), active warnings (from `/api/moderation/warnings/stats`)
  - Recent moderation feed: last 10 actions from `/api/moderation/logs?limit=10`
  - Group health: top 3 groups by moderation activity from `/api/analytics/overview`
  - Quick links section: product management, group configuration, broadcast
- Technical:
  - Fetch multiple API endpoints on mount using Promise.all
  - Move users list from `/dashboard` to `/dashboard/users`
  - Update sidebar nav: add "Overview" link to `/dashboard`, move "Users" to `/dashboard/users`
- UX:
  - Grid layout with responsive cards
  - KPI cards show value + delta (e.g., "+5 today" for new users)
  - Recent activity shows action type, actor, target, group, relative time
  - Loading skeleton while data fetches

## Dependencies
- All data APIs already exist
- Requires moving the users page to a new route (breaking change for bookmarks)
- Sidebar navigation needs updating

## Proposed approach
1. Create new `apps/frontend/src/app/dashboard/users/page.tsx` — move users list here
2. Rewrite `apps/frontend/src/app/dashboard/page.tsx` as overview dashboard
3. Update sidebar: change "Users" href from `/dashboard` to `/dashboard/users`; add "Overview" as first item or section header link
4. Fetch KPI data from 4 existing API endpoints in parallel
5. Render cards, activity feed, and quick links

## Deliverables
- New `apps/frontend/src/app/dashboard/users/page.tsx` — Relocated users list
- Rewritten `apps/frontend/src/app/dashboard/page.tsx` — Overview dashboard
- Updated `apps/frontend/src/components/sidebar.tsx` — Updated navigation
- Updated `apps/frontend/src/lib/api.ts` — Any missing convenience types

## Acceptance criteria
- [ ] `/dashboard` shows overview with KPI cards, activity feed, and quick links
- [ ] `/dashboard/users` shows the users list (previously at `/dashboard`)
- [ ] KPI cards show correct data from existing API endpoints
- [ ] Recent moderation activity feed shows last 10 actions
- [ ] Group health summary highlights groups needing attention
- [ ] Quick links navigate to correct pages
- [ ] Sidebar updated with Overview and Users entries
- [ ] Both old routes continue working (or redirect appropriately)
- [ ] `pnpm frontend build` passes

## Risks / Open questions
- Moving users from `/dashboard` to `/dashboard/users` changes the URL. Any external links or bookmarks will break. Consider adding a redirect.
- The `/dashboard` route in Next.js is the "default" for the dashboard section. Is it better to keep overview at `/dashboard` or at `/dashboard/overview`?
- How many API calls on mount is acceptable? 4-5 parallel fetches should be fine for an overview page.

## Notes
Current `/dashboard/page.tsx` is a client component with user stats cards + paginated users table. The stats (totalUsers, activeUsers, bannedUsers, newUsersToday) come from `api.getStats()`. The users table uses `api.getUsers()` with search and pagination.
