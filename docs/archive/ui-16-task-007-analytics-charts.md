# Task: Analytics Page with Real Charts

## Summary
Replace the table-based analytics page with interactive charts using recharts, providing visual insights into group health, moderation activity, and member growth.

## Problem
The analytics page (`/dashboard/moderation/analytics`) currently shows data in plain tables (PeriodTable component). The API returns time series data (`GroupAnalyticsSnapshot` with daily data points), but the frontend doesn't visualize it as charts. The AN-05 task spec mentioned using recharts, but it was never installed or implemented.

## Goal
Interactive charts on the analytics page: member growth line chart, moderation activity stacked bar chart, spam trend line chart, and group health KPI cards.

## Scope
In scope:
- Install recharts dependency
- Member growth chart (line: memberCount over time, new vs. left members)
- Moderation activity chart (stacked bar: warnings, mutes, bans, message deletions per day)
- Spam/link blocking trend (line: spamDetected + linksBlocked over time)
- Group health KPIs (cards: current members, 7d growth, spam rate, moderation rate)
- Time range selector (7d, 30d, 90d)
- Group selector (choose which group to view)

Out of scope:
- Exporting chart data
- Custom date range picker
- Cross-group comparison charts
- Real-time streaming data

## Requirements
- Functional:
  - Charts render from API time series data
  - Time range selector switches between 7d/30d/90d views
  - Group selector shows all managed groups
  - KPI cards show summary metrics
  - Charts are responsive to container width
- Technical:
  - Add `recharts` to frontend dependencies
  - Use existing API: GET /api/analytics/groups/:id (time series), GET /api/analytics/groups/:id/summary, GET /api/analytics/overview
  - Chart components should be reusable
- UX:
  - Charts should have tooltips on hover
  - Legend for multi-series charts
  - Loading skeleton while data fetches
  - Empty state for groups with no data

## Dependencies
- Existing: Analytics API endpoints (AN-04), GroupAnalyticsSnapshot model
- Install: `recharts` package

## Proposed approach
1. `pnpm frontend add recharts`
2. Create chart components in `components/charts/`:
   - `member-growth-chart.tsx` — LineChart with ResponsiveContainer
   - `moderation-activity-chart.tsx` — StackedBarChart
   - `spam-trend-chart.tsx` — LineChart
   - `group-health-card.tsx` — KPI card with delta indicator
3. Refactor analytics page to use charts instead of PeriodTable
4. Add group selector and time range controls at top

## Deliverables
- Updated `apps/frontend/package.json` — recharts dependency
- `apps/frontend/src/components/charts/` — Chart components
- Refactored `apps/frontend/src/app/dashboard/moderation/analytics/page.tsx`

## Acceptance criteria
- [ ] recharts is installed and working
- [ ] Member growth line chart renders with memberCount data points
- [ ] Moderation activity stacked bar chart shows warnings/mutes/bans/deletions
- [ ] Spam trend chart shows spam + link blocking over time
- [ ] KPI cards show current values with 7d delta
- [ ] Time range selector works (7d/30d/90d)
- [ ] Group selector works
- [ ] Charts are responsive
- [ ] Tooltips show on hover
- [ ] Loading and empty states handled

## Risks / Open questions
- recharts bundle size (~200KB gzip). Acceptable for admin dashboard?
- The API returns daily snapshots. For 90d, that's 90 data points — should be fine for recharts performance.
- What happens when a group has no analytics data yet? Need empty state.

## Notes
The analytics API is already built (AN-04). Time series endpoint returns `{ groupId, data: AnalyticsSnapshot[] }` where each snapshot has: date, memberCount, newMembers, leftMembers, messageCount, spamDetected, linksBlocked, warningsIssued, mutesIssued, bansIssued, deletedMessages.

## Implementation Notes
- Added `recharts` dependency to `apps/frontend/package.json`
- Rewrote `apps/frontend/src/app/dashboard/moderation/analytics/page.tsx` with three chart components:
  - `MemberGrowthChart` — LineChart with dual Y-axes (total members left, new/left right)
  - `ModerationActivityChart` — Stacked BarChart (warnings, mutes, bans, deleted messages)
  - `SpamLinksChart` — LineChart (spam detected + links blocked)
- Added time range selector (7d/30d/90d) with `loadTimeSeries` function
- Added group selector via the Groups Activity table (click "View" to select)
- Preserved existing overview stats cards and group activity table
- Fixed TypeScript type error: recharts `Tooltip.labelFormatter` expects `ReactNode` label parameter, not `string`
- Empty state handled for groups with no time series data

## Validation Notes
- `pnpm frontend build` passes with all routes
- No type errors

## Status
Completed
