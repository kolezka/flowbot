# UI-01 — Research Summary

## Architecture Findings

### Monorepo Structure
pnpm monorepo with 6 workspaces:
- `apps/bot` — E-commerce Telegram bot (grammY)
- `apps/manager-bot` — Group management Telegram bot (grammY)
- `apps/tg-client` — MTProto automation client (GramJS)
- `apps/api` — REST API (NestJS 11)
- `apps/frontend` — Admin dashboard (Next.js 16 App Router)
- `packages/db` — Shared Prisma database layer

### Database
PostgreSQL with Prisma 7. 18 models spanning e-commerce, moderation, analytics, automation, and identity domains. All apps share the same database through `@tg-allegro/db`.

### Communication Pattern
Apps communicate through the shared database (no message queue, no direct API calls between bots). The tg-client picks up jobs from the database. The API reads all data directly from PostgreSQL.

## Current Frontend Situation

### Technology Stack
- Next.js 16 with App Router
- Radix UI primitives (10 components: badge, button, card, checkbox, dialog, input, label, select, table, textarea)
- Tailwind CSS 4
- No charting library installed (recharts was mentioned in plans but not added)
- No authentication system
- No state management library (uses React useState/useEffect)
- API client: plain fetch wrapper in `lib/api.ts`

### Existing Dashboard Pages

**E-commerce (fully functional):**
- `/dashboard` — User list with stats cards
- `/dashboard/users/[id]` — User detail
- `/dashboard/users/[telegramId]/profile` — Unified cross-app profile
- `/dashboard/products` — Product list (CRUD)
- `/dashboard/products/[id]` — Product detail
- `/dashboard/products/new` — Create product
- `/dashboard/products/[id]/edit` — Edit product
- `/dashboard/categories` — Category list (CRUD)
- `/dashboard/categories/[id]` — Category detail
- `/dashboard/categories/new` — Create category
- `/dashboard/categories/[id]/edit` — Edit category
- `/dashboard/carts` — Cart list
- `/dashboard/broadcast` — Broadcast composer + list

**Moderation (partially functional):**
- `/dashboard/moderation` — Overview with stats cards, recent actions
- `/dashboard/moderation/groups` — Group list table
- `/dashboard/moderation/groups/[id]` — Group detail with config display
- `/dashboard/moderation/groups/[id]/members` — Member list
- `/dashboard/moderation/groups/[id]/warnings` — Warning list with deactivate action
- `/dashboard/moderation/logs` — Moderation log viewer with filters
- `/dashboard/moderation/analytics` — Analytics overview (tables only, no charts)

### Navigation
Simple top-bar with buttons: Users, Products, Categories, Carts, Broadcast, Moderation. No sidebar, no collapsible sections, no responsive mobile navigation.

## Manager-Bot Findings

### Implemented Features (21 features, all bot-command-only)
1. **Moderation**: warn/unwarn/mute/unmute/ban/unban/kick with escalation
2. **Anti-spam**: Flood + duplicate detection, AI-powered fallback
3. **Anti-link**: URL detection with domain whitelist
4. **CAPTCHA**: Button/math challenge on join
5. **Welcome**: Customizable welcome messages
6. **Rules**: /setrules, /rules, /pinrules
7. **Keyword filters**: /filter add|remove|list
8. **Media restrictions**: Granular per-media-type permissions
9. **Scheduled messages**: /remind, /schedule with cron-like delivery
10. **Audit log**: /modlog with channel forwarding
11. **Group config**: /settings, /config key value
12. **Cross-posting**: Template-based multi-group posting
13. **Product promotion**: /promote, /featured
14. **Pipeline**: Member→customer conversion automation
15. **Notifications**: Order event forwarding to groups
16. **AI moderation**: Claude-powered content classification
17. **Reputation**: Score calculation and commands
18. **Stats**: /stats with period selectors
19. **Deletion**: /del, /purge
20. **Permissions**: /mod, /unmod, /mods
21. **Setup**: /setlogchannel, bot add/remove handling

### What Has Dashboard Coverage
- Group list + detail (read-only config display)
- Moderation logs (view + filter)
- Warnings (view + deactivate)
- Members (view)
- Analytics (tables, no charts)

### What Lacks Dashboard Coverage
- **Group config editing** — /config is bot-only, dashboard shows config but can't edit most fields
- **Scheduled messages** — no UI at all, only /schedule command
- **Keyword filters** — no UI, only /filter command
- **Cross-post templates** — no UI, only /crosspost command
- **AI moderation config** — no UI, only /aimod command
- **CAPTCHA settings** — no UI, only /captcha command
- **Welcome message editing** — no UI
- **Rules editing** — no UI
- **Anti-link whitelist** — no UI
- **Media restrictions** — no UI
- **Reputation leaderboard** — API exists but no dedicated dashboard view
- **Member moderation actions** — can't warn/mute/ban from dashboard

## TG-Allegro (E-commerce Bot) Findings

### Dashboard Coverage
E-commerce features are well covered: products, categories, users, carts all have CRUD UI. Broadcast has a composer page.

### Missing Dashboard Coverage
- **Order events** — OrderEvent model exists, no UI to view/monitor
- **Automation jobs** — No UI to view pending/running/failed jobs
- **Client logs** — No UI to view tg-client operational logs
- **Client session status** — No UI to check session health

## API Coverage

### Endpoints With Frontend Pages
All moderation, analytics, user, product, category, cart, broadcast endpoints have corresponding frontend pages.

### Endpoints Without Frontend Pages
- `GET /api/reputation/:telegramId` — partially shown in unified profile, but no dedicated reputation view
- No automation job endpoints exist yet (documented in TC-19 but not implemented)

### Features Without API Endpoints
- Scheduled messages (ScheduledMessage model exists, no API)
- Keyword filters (stored in GroupConfig JSON, no dedicated API)
- Cross-post templates (CrossPostTemplate model exists, no API)
- Welcome message editing (stored in GroupConfig, only PATCH /config exposed)
- Rules text (stored in GroupConfig)
- Anti-link whitelist (stored in GroupConfig)
- AI moderation settings (stored in GroupConfig)
- CAPTCHA settings (stored in GroupConfig)

## Key Constraints and Assumptions

1. **No authentication** — The dashboard has zero auth. Anyone with the URL can access everything. This is a critical gap before adding write operations.
2. **GroupConfig stores most settings** — Many features store their config as fields on GroupConfig. The PATCH `/api/moderation/groups/:id/config` endpoint already supports updating these, but the frontend form only shows a subset.
3. **Separate models need separate API endpoints** — ScheduledMessage and CrossPostTemplate are separate Prisma models that need new CRUD API endpoints.
4. **No WebSocket/SSE** — The dashboard is fully request/response. No real-time updates. Acceptable for admin dashboard use case.
5. **Single operator assumption** — No multi-tenant or role-based access in the dashboard. All dashboard users are assumed to be admins.
