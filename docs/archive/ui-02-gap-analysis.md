# UI-02 — UI Gap Analysis

## Missing UI Areas

### Critical Gaps (High Impact, Frequently Needed)

| Gap | Who Uses It | Problem It Solves | Current Workaround |
|-----|------------|-------------------|-------------------|
| Group config editor | Admin/Moderator | Can't adjust moderation settings from web | Must use bot /config commands |
| Scheduled messages management | Admin | Can't view/create/cancel scheduled messages from web | Must use bot /schedule commands |
| Authentication | All | Dashboard is publicly accessible | None — security risk |
| Member moderation actions | Admin/Moderator | Can't warn/mute/ban from dashboard | Must use bot commands in group |

### Important Gaps (Medium Impact)

| Gap | Who Uses It | Problem It Solves | Current Workaround |
|-----|------------|-------------------|-------------------|
| Cross-post template management | Admin | Can't manage templates from web | Must use bot /crosspost commands |
| Automation job monitoring | Operator | Can't see job queue status | Must check database directly |
| Analytics charts | Admin | Analytics page shows tables, not visual charts | Read raw numbers |
| Keyword filter management | Admin/Moderator | Can't manage filters from web | Must use bot /filter commands |
| Reputation leaderboard | Admin | No overview of community reputation | Must check individual users |
| Navigation overhaul | All | Dashboard nav doesn't scale, no mobile support | Scroll through top bar |

### Nice-to-Have Gaps (Lower Priority)

| Gap | Who Uses It | Problem It Solves | Current Workaround |
|-----|------------|-------------------|-------------------|
| Welcome message editor | Admin | Can't preview/edit welcome messages from web | Bot /setwelcome command |
| Rules editor | Admin | Can't edit rules text from web | Bot /setrules command |
| AI moderation config | Admin | Can't adjust AI settings from web | Bot /aimod commands |
| CAPTCHA settings | Admin | Can't adjust CAPTCHA from web | Bot /captcha commands |
| Anti-link whitelist | Admin | Can't manage domain whitelist from web | Bot /allowlink commands |
| Media restriction config | Admin | Can't adjust media permissions from web | Bot /restrict commands |
| Client logs viewer | Operator | Can't view tg-client operational logs | Check database/stdout |
| Order event monitor | Operator | Can't see order notification pipeline | Check database |

## Approach Comparison

### Option A: Extend Existing Frontend (`apps/frontend`)

**Pros:**
- Single codebase — no new deployment, build pipeline, or CI configuration
- Reuses existing Radix UI component library and Tailwind CSS setup
- Reuses existing `lib/api.ts` client (already has moderation interfaces)
- Navigation already includes "Moderation" section
- Consistent UX for operators who already use the dashboard
- Database/API layer is shared — no duplication
- Most moderation API endpoints already exist
- Lower total maintenance burden (one frontend to update)

**Cons:**
- Dashboard is growing — may become unwieldy without navigation restructuring
- No separation of concerns between e-commerce and moderation
- If different auth requirements emerge later (e.g., e-commerce admin vs. moderation admin), harder to enforce in single app
- Next.js bundle size grows with more pages (mitigated by App Router code splitting)

**Dependencies:**
- Navigation restructuring (current flat nav won't scale)
- New API endpoints for scheduled messages, cross-post templates, automation jobs
- Auth system (currently none)

**Implementation complexity:** Low-Medium. Most infrastructure exists.

**Long-term maintainability:** Good. Single source of truth for admin UI. Natural fit since all data comes from same database.

### Option B: Create New Frontend (e.g., `apps/moderation-dashboard`)

**Pros:**
- Clean separation between e-commerce admin and moderation admin
- Could use different tech stack if desired
- Independent deployment and scaling
- Could have its own auth system from day one

**Cons:**
- Duplicates infrastructure: build config, component library, API client, deployment
- Inconsistent UX — two different dashboards for operators who manage both
- More code to maintain long-term
- Would need to duplicate or share the Radix UI components
- Users and unified profiles span both domains — splitting UI is awkward
- No actual requirement for separation (same operators manage both)
- Significantly more work for marginal benefit

**Dependencies:**
- Full project scaffolding (Next.js, Tailwind, Radix, etc.)
- New deployment configuration
- Potentially shared component package
- Same API endpoints needed

**Implementation complexity:** High. Building from scratch.

**Long-term maintainability:** Poor. Two frontends to maintain for the same user base.

## Recommendation

**Extend the existing frontend (`apps/frontend`).** Strong recommendation.

### Rationale
1. The existing dashboard already has moderation pages (overview, groups, logs, analytics) — extending is natural
2. The operators who manage moderation are the same people who manage products — one unified dashboard is better UX
3. All API infrastructure is already in place for the NestJS backend
4. The frontend API client (`lib/api.ts`) already has moderation interfaces defined
5. Creating a second frontend would be wasteful — there's no technical or organizational reason to separate
6. Next.js App Router's code splitting prevents bundle bloat concerns
7. The real gap is missing pages and features, not architectural — the foundation is solid

### Required Prerequisites
1. **Navigation restructuring** — Current flat top-bar won't scale. Need sidebar or grouped navigation.
2. **Authentication** — Before adding write operations (config editing, member actions), auth is needed.
3. **New API endpoints** — ScheduledMessage CRUD, CrossPostTemplate CRUD, AutomationJob listing.
