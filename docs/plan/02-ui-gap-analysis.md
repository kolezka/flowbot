# UI Gap Analysis — Phase 2

## Gap Inventory

### Gap 1: Order Event Monitoring (CRITICAL)
- **What's missing:** Frontend page to view OrderEvent records
- **Backend support:** OrderEvent Prisma model exists. `GET /api/automation/order-events` endpoint exists with pagination and `processed` filter.
- **Who needs it:** Operators monitoring order notification delivery
- **Problem:** Order events are completely invisible in the dashboard. When the tg-client sends order notifications (order_placed, order_shipped) to group chats, operators have no way to verify delivery status, see failures, or track which orders triggered notifications.
- **Effort:** Low — API already exists, needs frontend page only

### Gap 2: TG Client Health & Session Monitoring (CRITICAL)
- **What's missing:** Dashboard visibility into tg-client operational status
- **Backend support:** ClientSession model exists. tg-client has a health endpoint on port 3002 returning transport status, session validity, uptime, last action timestamp. No API proxy to this health endpoint.
- **Who needs it:** System operators
- **Problem:** If the tg-client goes down, stops authenticating, or enters circuit-breaker open state, nobody knows until jobs start failing. There's no proactive monitoring.
- **Effort:** Medium — needs API proxy endpoint + frontend dashboard

### Gap 3: Dashboard Home Page (HIGH)
- **What's missing:** A proper overview/home page
- **Backend support:** All data APIs exist (user stats, analytics overview, automation stats, warning stats)
- **Who needs it:** All dashboard users
- **Problem:** `/dashboard` currently shows the users list page. There's no at-a-glance overview combining e-commerce stats, moderation activity, automation health, and recent events.
- **Effort:** Medium — frontend-only, aggregates existing API data

### Gap 4: Broadcast Lifecycle Completeness (HIGH)
- **What's missing:** Edit, delete, and retry capabilities for broadcasts
- **Backend support:** BroadcastMessage model exists. API has GET and POST but no PATCH or DELETE.
- **Who needs it:** Admins managing broadcasts
- **Problem:** Once a broadcast is created, it cannot be modified, cancelled (if pending), or retried (if failed). Admins must create new broadcasts to correct mistakes.
- **Effort:** Medium — needs API extensions + frontend updates

### Gap 5: Role & Permission Management (HIGH)
- **What's missing:** Web UI for managing moderator roles
- **Backend support:** GroupMember model has `role` field. Manager-bot has /mod, /unmod, /mods commands. NO API endpoints for role changes.
- **Who needs it:** Group admins managing their moderation team
- **Problem:** Promoting/demoting moderators requires being in the Telegram group and using bot commands. Can't manage roles from the dashboard.
- **Effort:** Medium — needs new API endpoints + frontend UI

### Gap 6: Quarantine Member Management (MEDIUM)
- **What's missing:** Dedicated view for quarantined members
- **Backend support:** GroupMember has `isQuarantined` and `quarantineExpiresAt` fields. Members API can filter by role but not by quarantine status.
- **Who needs it:** Moderators monitoring new member verification
- **Problem:** When CAPTCHA/quarantine is enabled, new members are restricted. There's no overview of who's in quarantine, when it expires, or ability to manually release members.
- **Effort:** Medium — needs API filter extension + frontend component

### Gap 7: Data Export (MEDIUM)
- **What's missing:** Ability to export moderation logs, analytics, member lists as CSV/JSON
- **Backend support:** All data APIs exist with pagination
- **Who needs it:** Admins creating reports, compliance documentation
- **Problem:** Dashboard is view-only. To get data out for reporting, admins must query the database directly.
- **Effort:** Medium — needs export API endpoints + frontend download triggers

### Gap 8: System Status Overview (MEDIUM)
- **What's missing:** Unified health status showing all system components
- **Backend support:** API health endpoint exists. tg-client has separate health endpoint. Manager-bot has health endpoint.
- **Who needs it:** System operators
- **Problem:** No single view showing whether all system components (API, manager-bot, tg-client, database) are healthy.
- **Effort:** Medium — needs aggregation endpoint + frontend status page

## User/Operator Workflows Analysis

### Workflow: Order Notification Monitoring
1. E-commerce bot receives order event → creates OrderEvent record
2. TG client picks up event → sends notification to configured groups
3. **GAP:** Operator cannot see order events, their processing status, or delivery results from dashboard
4. Fix: Order events page with status filter, group filter, event details

### Workflow: System Health Check
1. Operator wants to verify all systems are running
2. **GAP:** Must check each service's health endpoint individually (API:3000, tg-client:3002, manager-bot health)
3. Fix: Unified status page aggregating all health checks

### Workflow: Moderator Team Management
1. Group admin wants to promote a trusted member to moderator
2. **GAP:** Must go to Telegram group, find the user, use /mod command
3. Fix: Role management UI in the group members page

### Workflow: Broadcast Correction
1. Admin creates broadcast with typo
2. **GAP:** Cannot edit or cancel — must create a new correction broadcast
3. Fix: Edit pending broadcasts, cancel/delete capability

## Approach Comparison

### Option A: Extend Existing Frontend (RECOMMENDED)
**Pros:**
- Consistent UI/UX with 27 existing pages
- Reuse existing components (Sidebar, Card, Table, Badge, Button)
- Shared auth system already in place
- API client patterns established (add methods to ApiClient class)
- Navigation structure supports new sections
- No new deployment target

**Cons:**
- Frontend bundle grows (mitigated by Next.js code splitting)
- More pages to maintain in one app

**Dependencies:**
- Some gaps need new API endpoints first
- Some need Prisma schema awareness (already shared)

**Complexity:** Low-Medium per task

**Maintainability:** Good — follows established patterns

### Option B: Create New Frontend
**Pros:**
- Clean separation of concerns
- Could use different tech stack if desired
- Independent deployment

**Cons:**
- Duplicates auth, navigation, UI components
- Different code style creates maintenance burden
- Users must context-switch between dashboards
- Deployment complexity doubles
- Shared Prisma types need republishing

**Dependencies:**
- Auth system needs to be shared or duplicated
- API client needs reimplementation
- Component library needs copying or publishing as package

**Complexity:** High — entire new project scaffolding

**Maintainability:** Poor — two frontends to maintain with same data

## Recommendation

**Extend the existing `apps/frontend`** for all Phase 2 work. The existing dashboard has proven patterns, comprehensive component library, authentication, and navigation structure that supports adding new sections. Creating a new frontend would double maintenance burden with zero user benefit.
