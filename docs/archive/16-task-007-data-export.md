# Task: Data Export for Moderation Logs, Analytics, and Members

## Summary
Add CSV/JSON export capabilities for moderation logs, analytics data, and member lists, enabling admins to create reports and maintain compliance documentation.

## Problem
The dashboard is view-only for analytical data. Admins who need to generate reports, share moderation activity with stakeholders, or maintain audit records must query the database directly. There's no way to export filtered data from any dashboard page.

## Goal
Export buttons on key pages that download filtered data as CSV or JSON files.

## Scope
In scope:
- Export moderation logs (filtered by current view filters)
- Export group analytics (time series data for selected group and time range)
- Export group member list (for a specific group)
- CSV and JSON format options
- Export respects current page filters

Out of scope:
- Scheduled/automated exports
- Email delivery of exports
- Export of all data across all groups in one operation
- PDF report generation

## Requirements
- Functional:
  - Export button on moderation logs page — downloads filtered logs as CSV/JSON
  - Export button on analytics page — downloads time series data as CSV/JSON
  - Export button on group members page — downloads member list as CSV/JSON
  - File names include group name and date (e.g., `moderation-logs-2026-03-09.csv`)
- Technical:
  - New API endpoints: `GET /api/moderation/logs/export`, `GET /api/analytics/groups/:id/export`, `GET /api/moderation/groups/:groupId/members/export`
  - Accept format query param (`?format=csv` or `?format=json`)
  - Accept same filter params as the list endpoints
  - Set appropriate Content-Type and Content-Disposition headers
  - No pagination limit on export (but cap at 10,000 rows to prevent memory issues)
- UX:
  - Export button next to filter controls
  - Format selector (CSV/JSON dropdown or toggle)
  - Loading indicator during export
  - Export uses current page filters

## Dependencies
- Existing list endpoints for each data type
- Frontend needs to trigger file downloads (not API fetch + render)

## Proposed approach

### Backend
1. Add `/export` suffix endpoints to existing controllers (logs, analytics, members)
2. Accept same query params as list endpoints plus `format` param
3. For CSV: use simple string concatenation (no external library needed for NestJS)
4. Set `Content-Type: text/csv` or `application/json` and `Content-Disposition: attachment`
5. Cap at 10,000 rows

### Frontend
1. Add export button component (reusable: accepts URL + current filters + format)
2. Trigger download via `window.open(url)` or `fetch` + `Blob` + download link
3. Add to moderation logs page, analytics page, and group members page
4. Include auth token in export request headers

## Deliverables
- Updated API controllers with export endpoints (logs, analytics, members)
- New export utility in API for CSV generation
- Reusable export button component in frontend
- Updated pages: moderation logs, analytics, group members

## Acceptance criteria
- [ ] Moderation logs export works with current filters applied
- [ ] Analytics time series export works for selected group and date range
- [ ] Member list export works for selected group
- [ ] CSV format produces valid CSV with headers
- [ ] JSON format produces valid JSON array
- [ ] File names include meaningful context (group name, date)
- [ ] Auth token included in export requests (no unauthorized exports)
- [ ] Export capped at 10,000 rows with appropriate message
- [ ] Both builds pass

## Risks / Open questions
- CSV generation with special characters (commas in names, Unicode). Need proper escaping.
- Large exports (10k rows) may take several seconds. Should we show a progress indicator or just a spinner?
- Should export include BigInt fields as numbers or strings? CSV doesn't have type safety, but JSON should use strings for BigInt values.

## Notes
No external CSV library needed. NestJS can set response headers directly. For CSV, simple `field1,field2\nvalue1,value2` generation works. The frontend can trigger downloads using `<a>` tag with `download` attribute and blob URL, or via `window.open` with auth token in query param (less secure) or custom header.
