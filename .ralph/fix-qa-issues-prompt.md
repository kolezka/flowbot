# Fix QA Issues — Agent Team Orchestration Prompt

You are the **Lead/Scrum Master** orchestrating a team of agents to fix all open QA issues documented in `docs/issues/`. Your job is to:

1. Track progress using a task list (TodoWrite)
2. Dispatch agents to fix issues (in parallel where independent)
3. Verify each fix using Playwright manual QA
4. Commit and push each fix separately
5. Update issue status in `docs/issues/` when fixed

## Prerequisites

Before starting, ensure the development environment is running:
- **PostgreSQL:** `docker compose up -d`
- **API:** `pnpm api start:dev` (port 3000)
- **Frontend:** `pnpm frontend dev` (port 3001)
- **Trigger.dev worker** (optional, only for trigger-related testing):
  ```bash
  TRIGGER_SECRET_KEY=tr_dev_pd7r4ISDoUW36jlJSVLH npx trigger.dev@3.3.17 dev --api-url https://trigger.raqz.link --skip-update-check
  ```

Start all services in background before dispatching fix agents. The API must be restarted after backend changes (kill and restart `pnpm api start:dev`).

## Issue Registry (Open Issues)

Read all issue files from `docs/issues/*.md` to get the current list. Skip issues with Status: Fixed.

The following issues were identified during QA. They are grouped by root cause to enable efficient parallel fixing:

### Group A: AutomationModule Not Registered (Backend)
**Root cause:** `AutomationModule` not imported in `apps/api/src/app.module.ts`
- **#001** (partial): `/api/automation/jobs/stats` 404 — caused by missing module
- **#006** (partial): Multiple 404s — automation endpoints caused by missing module
- **#010**: Order Events page fails to load
- **#012**: AutomationModule not registered in AppModule

**Fix:** Add `import { AutomationModule } from './automation/automation.module';` and add `AutomationModule` to the `imports` array in `apps/api/src/app.module.ts`.

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard/automation/health` — should NOT show "Failed to load health data"
- Navigate to `http://localhost:3001/dashboard/automation/jobs` — should NOT show "Failed to load jobs"
- Navigate to `http://localhost:3001/dashboard/automation/order-events` — should NOT show "Failed to load order events"
- Check browser console for 404 errors on `/api/automation/*` endpoints — should be gone

### Group B: Frontend API URL Mismatches
**Root cause:** Frontend API client uses wrong URL paths
- **#001** (partial): `/api/moderation/warnings/stats` should be `/api/warnings/stats`
- **#005**: `/api/moderation/groups` should be `/api/groups`
- **#006** (partial): Multiple wrong URLs in frontend

**Fix:** In `apps/frontend/src/lib/api.ts`:
- Change `/api/moderation/warnings/stats` → `/api/warnings/stats`
- Change all `/api/moderation/groups` → `/api/groups` (check all occurrences — groups listing, group details, etc.)

**Important:** Do NOT change `/api/moderation/groups/:groupId/members` — that path is correct. Only change the groups listing endpoint.

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard` — no 404 errors for warnings/stats in console
- Navigate to `http://localhost:3001/dashboard/moderation/groups` — groups should load (or show empty list, not "Failed to load")

### Group C: Flows Global Analytics Route Collision (Backend)
**Root cause:** NestJS routes `GET /api/flows/analytics` to `:id` handler instead of `analytics` handler
- **#011**: Flows analytics page fails to load
- **#013**: Route collision with `:id` parameter

**Fix:** In `apps/api/src/flows/flows.controller.ts`, the `@Get(':id')` handler catches "analytics" as an ID. Fix by either:
1. Moving the `@Get('analytics')` method into a separate controller class, OR
2. Adding a guard in the `@Get(':id')` handler to skip reserved words, OR
3. Restructuring the route (e.g., `@Get('global-analytics')` and updating the frontend)

Whichever approach you choose, also update the frontend if the endpoint path changes.

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard/flows/analytics` — should show analytics data (stats cards with 0 values), NOT "Failed to load analytics"
- Verify `http://localhost:3001/dashboard/flows/cmmkj2j0h0019iqi5j21fqd8d/analytics` (per-flow analytics) still works

### Group D: Missing Groups Endpoint (Backend)
**Root cause:** No `GET /api/moderation/groups` endpoint exists
- **#008**: Scheduled Messages groups dropdown empty
- **#009**: Crosspost groups fail to load
- **#014**: Missing GET /api/moderation/groups endpoint

**Note:** This overlaps with Group B. After Group B fixes the frontend URL to `/api/groups`, verify that endpoint works. If the groups endpoint at `/api/groups` already exists and works, this group is resolved by Group B. If not, a new endpoint or controller fix is needed.

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard/automation/crosspost-templates` — click "New Template", group checkboxes should appear (or show empty list, not console 404)
- Navigate to `http://localhost:3001/dashboard/moderation/scheduled-messages` — group dropdown should have groups (or show empty, not just "All Groups" with 404 error)

### Group E: Chart Rendering (Frontend)
- **#002**: Dashboard charts render with negative dimensions (-1 x -1)

**Fix:** In dashboard chart components (likely `apps/frontend/src/app/dashboard/page.tsx`), add `minWidth={0}` and `minHeight={0}` to Recharts `ResponsiveContainer` or chart components. Search for `ResponsiveContainer` usage.

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard` — check console for "width(-1) and height(-1)" warnings — should be gone or significantly reduced

### Group F: WebSocket Connection (Frontend/Backend)
- **#003**: WebSocket connection fails on dashboard

**Fix:** Investigate `apps/api/src/events/events.gateway.ts` and `apps/frontend/src/lib/websocket.tsx`. Check:
1. Is the EventsModule registered in AppModule?
2. Are CORS settings correct for WebSocket?
3. Is Socket.IO properly configured?

**Verify with Playwright:**
- Navigate to `http://localhost:3001/dashboard` — check console for WebSocket warnings — should connect or gracefully handle disconnection

### Group G: Trigger.dev Version Mismatch (Config)
- **#016**: SDK v3.3.17 vs CLI v4.4.3 mismatch

**Fix:** In `apps/trigger/package.json`, pin the CLI version in dev script:
- Change `"dev": "npx trigger.dev@latest dev"` to `"dev": "npx trigger.dev@3.3.17 dev"`

**No Playwright verification needed** — just ensure `pnpm trigger dev` starts without version errors.

## Execution Strategy

### Phase 1: Create Task List
Use TodoWrite to create tasks for each group. Mark them as `in_progress` when an agent starts, `completed` when verified.

### Phase 2: Dispatch Fix Agents (Parallel where possible)
- **Groups A + B** can be done in parallel (backend vs frontend, different files)
- **Group C** can run in parallel with A and B (different controller file)
- **Group D** depends on Group B being done first (need to verify if `/api/groups` works)
- **Groups E, F, G** can run in parallel with each other and after A/B/C

For each agent, provide:
1. The issue details and root cause
2. Files to modify
3. What NOT to change (avoid breaking other things)
4. Verification steps

### Phase 3: Restart API & Verify
After backend changes (Groups A, C, D), restart the API server and verify all fixes using Playwright:
1. Navigate to each affected page
2. Check that error messages are gone
3. Check browser console for 404 errors
4. Take note of any remaining issues

### Phase 4: Commit & Push
For each fix group, create a separate commit:
```
git add <specific files>
git commit -m "fix: <description>

Resolves #XXX, #YYY
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push
```

### Phase 5: Update Issue Status
After verification, update each fixed issue's markdown file: change `**Status:** Open` to `**Status:** Fixed`.
Update `docs/issues/README.md` table accordingly.

## Important Notes

- **Do NOT modify test files** unless a test is directly broken by the fix
- **Run existing tests** after fixes: `pnpm api test` to ensure no regressions
- **Frontend changes** don't require API restart — Next.js hot-reloads
- **Backend changes** require API restart to take effect
- **Login for Playwright QA:** navigate to `http://localhost:3001/login`, use password `admin`
- **Dashboard token** is stored in localStorage as `dashboard_token`
- **Trigger.dev self-hosted** at `trigger.raqz.link`, project ref `proj_hilpmfmsfxxbgutxovgl`
