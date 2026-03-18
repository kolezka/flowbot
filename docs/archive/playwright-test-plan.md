# Playwright E2E Test Plan — flowbot Dashboard

> **Status:** Implementation in progress — see `.ralph/playwright-test-plan.md` for live progress
> **Date:** 2026-03-10
> **Scope:** Full E2E coverage for `apps/frontend` (Next.js dashboard) against `apps/api` (NestJS backend)

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Application Area Inventory](#2-application-area-inventory)
3. [Test Strategy](#3-test-strategy)
4. [Infrastructure Requirements](#4-infrastructure-requirements)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Detailed Task List](#6-detailed-task-list)
7. [Technical Recommendations](#7-technical-recommendations)
8. [Risks, Gaps & Blockers](#8-risks-gaps--blockers)
9. [Proposed Execution Order](#9-proposed-execution-order)

---

## 1. Current State Audit

### What Exists

| Item | Status | Location |
|------|--------|----------|
| Playwright dependency | `@playwright/test@1.52.0` installed | `apps/frontend/package.json` |
| Config file | Basic config, chromium only | `apps/frontend/playwright.config.ts` |
| Auth fixture | Password-based login helper | `apps/frontend/e2e/fixtures/auth.ts` |
| Smoke tests | 2 tests (flow create + navigate) | `apps/frontend/e2e/smoke.spec.ts` |
| Test script | `pnpm frontend test:e2e` | `apps/frontend/package.json` |
| webServer config | Auto-starts `pnpm dev` on :3001 | `playwright.config.ts` |

### What's Missing

| Item | Impact | Priority |
|------|--------|----------|
| `data-testid` attributes | No test-stable selectors anywhere in the codebase | High |
| Database seeding | No seed scripts for reproducible test data | Critical |
| Test database isolation | Tests would hit dev DB; no separate test DB in docker-compose | Critical |
| API mocking layer (MSW) | No HTTP mocking for isolated frontend tests | Medium |
| CI/CD pipeline | No `.github/workflows/` — tests can't run automatically | High |
| Multi-browser projects | Only chromium configured | Low |
| Global setup/teardown | No DB reset between test suites | High |
| Page Object Models | No POM pattern — only raw page interactions | Medium |
| Test data factories | No factory functions for creating test entities | High |
| Environment config | No `.env.test` or test-specific env vars | High |

### Existing Test Coverage (Non-Playwright)

| Workspace | Framework | Tests | Coverage |
|-----------|-----------|-------|----------|
| `apps/api` | Jest | 135 | Service layer (mocked Prisma) |
| `apps/manager-bot` | Vitest | 73 | Bot features |
| `packages/telegram-transport` | Vitest | 24 | Transport layer |
| `apps/frontend` | Playwright | 2 | Flow smoke only |
| `apps/trigger` | Vitest | 0 | Empty setup |
| `apps/bot` | — | 0 | No test framework |

---

## 2. Application Area Inventory

### 2.1 Authentication

| Area | Routes | Complexity |
|------|--------|-----------|
| Login | `/login` | Low |
| Token persistence | localStorage `dashboard_token` | Low |
| Auth guard redirect | All `/dashboard/*` → `/login` | Low |
| Logout | Sidebar footer button | Low |
| Token expiry (7d JWT) | Auto-redirect on 401 | Medium |

**Critical flows:** Login → dashboard redirect, unauthorized access → login redirect, logout → token clear.

### 2.2 Navigation & Layout

| Area | Details |
|------|---------|
| Sidebar | 9 sections, collapsible, auto-expand on active child |
| Mobile sidebar | Sheet overlay, hamburger toggle, auto-close on nav |
| Breadcrumbs | Available but usage varies |
| Theme toggle | Light/Dark/System in sidebar footer |
| Connection status | Live/Offline indicator (WebSocket) |

### 2.3 E-commerce CRUD

| Entity | List | Detail | Create | Edit | Delete | Filters |
|--------|------|--------|--------|------|--------|---------|
| Users | ✓ | ✓ (+ profile) | — | Ban/Unban | — | Search, status |
| Products | ✓ | ✓ | ✓ | ✓ | ✓ | Search, category, status, stock |
| Categories | ✓ (tree) | ✓ | ✓ | ✓ | ✓ | — |
| Carts | ✓ | ✓ | — | Add/Remove items | Clear | — |

### 2.4 Moderation

| Area | Routes | Operations |
|------|--------|-----------|
| Groups | `/moderation/groups`, `/groups/[id]` | List, config edit |
| Members | `/groups/[id]/members` | List, release, role change, warn/mute/ban |
| Warnings | `/groups/[id]/warnings` | List, deactivate |
| Logs | `/moderation/logs` | List with filters, stats |
| Analytics | `/moderation/analytics` | Charts, time series |
| Scheduled messages | `/moderation/scheduled-messages` | Create, delete |

### 2.5 Automation

| Area | Routes | Operations |
|------|--------|-----------|
| Broadcast | `/broadcast` | Create, edit, delete, retry |
| Health | `/automation/health` | Read-only status |
| Jobs | `/automation/jobs` | List, detail view |
| Cross-post templates | `/automation/crosspost-templates` | CRUD |
| Order events | `/automation/order-events` | List, create |

### 2.6 Bot Configuration

| Area | Routes | Operations |
|------|--------|-----------|
| Instances | `/bot-config` | CRUD |
| Commands | `/bot-config/[botId]/commands` | CRUD, reorder |
| Responses | `/bot-config/[botId]/responses` | CRUD with locale |
| Menus | `/bot-config/[botId]/menus` | CRUD + buttons |
| I18n | `/bot-config/[botId]/i18n` | CRUD with locale |
| Publish | `/bot-config/[botId]` | Version publish |

### 2.7 Flow Builder

| Area | Routes | Operations |
|------|--------|-----------|
| Flow list | `/flows` | CRUD, activate/deactivate |
| Templates | `/flows/templates` | Browse, use |
| Editor | `/flows/[id]/edit` | Visual node editor (ReactFlow), drag & drop, save |
| Executions | `/flows/[id]/executions` | List, detail |
| Live view | `/flows/[id]/live` | Real-time monitoring |
| Versions | `/flows/[id]/versions` | Create, restore |
| Analytics | `/flows/[id]/analytics` | Charts |

### 2.8 Telegram Client

| Area | Routes | Operations |
|------|--------|-----------|
| Sessions | `/tg-client`, `/tg-client/sessions/[id]` | List, detail, deactivate, rotate |
| Auth | `/tg-client/auth` | Multi-step auth flow |
| Health | `/tg-client/health` | Transport status |

### 2.9 System & Webhooks

| Area | Routes | Operations |
|------|--------|-----------|
| System status | `/system/status` | Read-only health dashboard |
| Webhooks | `/webhooks` | Create, delete, list |
| Reputation | `/community/reputation` | Leaderboard (read-only) |

### 2.10 Cross-Cutting Concerns

| Concern | Details |
|---------|---------|
| Pagination | Most list pages: prev/next, page numbers, 10 items/page |
| Search | Users, products, groups — real-time debounced |
| Filters | Status filters (active/banned), category, stock |
| Responsive | Mobile card view via `ResponsiveTable`, sheet sidebar |
| Theme | Dark/Light/System toggle, persisted in localStorage |
| Toasts | Sonner — success/error feedback on CRUD ops |
| Confirm dialogs | Destructive actions (delete, ban) |
| Loading states | Skeletons, disabled buttons, "Loading..." text |
| Empty states | Custom `EmptyState` component with action |
| WebSocket | Real-time updates for moderation, automation, system |
| Error display | Inline red alert boxes, console logging |

---

## 3. Test Strategy

### 3.1 Test Pyramid for E2E

```
        ╱ Smoke (P0) ╲          ← 5-10 tests, runs on every PR
       ╱ Critical Path (P1) ╲    ← 20-30 tests, core business flows
      ╱ Feature Coverage (P2) ╲  ← 40-60 tests, all CRUD + forms
     ╱ Edge Cases & UX (P3) ╲    ← 20-30 tests, error states, responsive
    ╱ Visual & A11y (P4) ╲       ← 10-15 tests, theme, accessibility
```

### 3.2 Test Modes

| Mode | Description | When |
|------|-------------|------|
| **Full Integration** | Frontend + real API + real DB (seeded) | Default for E2E |
| **API Mocked** | Frontend + MSW intercepted responses | Optional for speed |

**Recommendation:** Start with full integration (frontend ↔ API ↔ seeded DB). Add MSW only for edge cases that are hard to reproduce with real data (error states, empty states, specific validation errors).

### 3.3 Test Organization

```
apps/frontend/e2e/
├── fixtures/
│   ├── auth.ts                    # Auth fixture (exists)
│   ├── db.ts                      # DB seed/reset helpers
│   └── api.ts                     # API helper (direct API calls for setup)
├── page-objects/
│   ├── sidebar.po.ts
│   ├── login.po.ts
│   ├── products.po.ts
│   ├── categories.po.ts
│   ├── users.po.ts
│   ├── groups.po.ts
│   ├── broadcast.po.ts
│   ├── bot-config.po.ts
│   ├── flows.po.ts
│   └── ...
├── helpers/
│   ├── test-data.factory.ts       # Factory functions for test entities
│   ├── assertions.ts              # Custom expect matchers
│   └── selectors.ts               # Shared selectors
├── smoke/
│   └── smoke.spec.ts              # P0: Critical smoke tests
├── auth/
│   ├── login.spec.ts
│   └── session.spec.ts
├── ecommerce/
│   ├── products.spec.ts
│   ├── categories.spec.ts
│   ├── users.spec.ts
│   └── carts.spec.ts
├── moderation/
│   ├── groups.spec.ts
│   ├── members.spec.ts
│   ├── warnings.spec.ts
│   ├── logs.spec.ts
│   └── scheduled-messages.spec.ts
├── automation/
│   ├── broadcast.spec.ts
│   ├── jobs.spec.ts
│   └── crosspost-templates.spec.ts
├── bot-config/
│   ├── instances.spec.ts
│   ├── commands.spec.ts
│   ├── responses.spec.ts
│   └── menus.spec.ts
├── flows/
│   ├── flow-crud.spec.ts
│   ├── flow-editor.spec.ts
│   ├── flow-executions.spec.ts
│   └── flow-versions.spec.ts
├── tg-client/
│   └── sessions.spec.ts
├── system/
│   ├── status.spec.ts
│   └── webhooks.spec.ts
├── navigation/
│   ├── sidebar.spec.ts
│   └── responsive.spec.ts
└── cross-cutting/
    ├── theme.spec.ts
    ├── pagination.spec.ts
    ├── search-filter.spec.ts
    ├── error-handling.spec.ts
    └── empty-states.spec.ts
```

### 3.4 Selector Strategy

**Priority order** (following Playwright best practices):
1. `getByRole()` — buttons, headings, links, inputs
2. `getByLabel()` — form fields
3. `getByPlaceholder()` — text inputs
4. `getByText()` — visible text content
5. `data-testid` — only where semantic selectors are ambiguous

**Assumption:** Most interactions can use role/label/text selectors. Add `data-testid` selectively where needed (tables, dynamic lists, similar buttons).

---

## 4. Infrastructure Requirements

### 4.1 Test Database

**Task:** Add a test database service to `docker-compose.yml`.

```yaml
postgres-test:
  image: postgres:18-alpine
  ports: ["5433:5432"]
  environment:
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    POSTGRES_DB: flowbot_test
```

**Task:** Create `.env.test` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/flowbot_test`.

### 4.2 Database Seeding

**Task:** Create `packages/db/prisma/seed.ts` with:
- Minimum viable seed data for all 28 models
- Deterministic IDs for test assertions
- Idempotent (safe to run multiple times)

**Task:** Create `apps/frontend/e2e/fixtures/db.ts` with:
- `resetDatabase()` — truncate all tables
- `seedTestData()` — insert baseline test data
- Global setup: seed before test suite, reset between specs if needed

### 4.3 Playwright Config Updates

**Task:** Enhance `playwright.config.ts`:
- Add `globalSetup` for DB seeding
- Add `globalTeardown` for cleanup
- Add Firefox + WebKit projects (optional, lower priority)
- Configure `screenshot: 'only-on-failure'`
- Add `video: 'retain-on-failure'` for debugging
- Configure `expect.timeout` and `actionTimeout`

### 4.4 API Helper Fixture

**Task:** Create `apps/frontend/e2e/fixtures/api.ts`:
- Direct HTTP calls to API for test setup (create products, users, etc.)
- Bypass UI for data preparation — faster, more reliable
- Use auth token from fixture

### 4.5 CI/CD Pipeline

**Task:** Create `.github/workflows/e2e.yml`:
- Trigger: PR to main, push to main
- Services: PostgreSQL
- Steps: install deps → migrate DB → seed → build API → build frontend → run Playwright
- Artifacts: HTML report, traces, screenshots

### 4.6 Environment Configuration

**Task:** Create `.env.test` files:
- `apps/api/.env.test` — test DB URL, test JWT secret, test port
- `apps/frontend/.env.test` — `NEXT_PUBLIC_API_URL=http://localhost:3000`
- `DASHBOARD_SECRET=admin` (matches existing fixture)

---

## 5. Implementation Roadmap

### Phase 0: Infrastructure Setup (Foundation)
> **Goal:** Repeatable, isolated test environment
> **Estimated tasks:** 8
> **Must complete before any test writing**

### Phase 1: Smoke & Auth Tests (P0)
> **Goal:** Verify app boots, login works, basic navigation
> **Estimated tasks:** 4
> **Unlocks:** All subsequent phases

### Phase 2: E-commerce CRUD (P1)
> **Goal:** Cover core business entities — products, categories, users
> **Estimated tasks:** 6
> **Business value:** Highest — these are the money-making features

### Phase 3: Moderation Features (P1)
> **Goal:** Cover group management, warnings, logs
> **Estimated tasks:** 5
> **Business value:** High — moderation is daily operator activity

### Phase 4: Automation & Broadcast (P1)
> **Goal:** Cover broadcast, jobs, cross-post templates
> **Estimated tasks:** 4

### Phase 5: Bot Configuration (P2)
> **Goal:** Cover bot instances, commands, responses, menus
> **Estimated tasks:** 4

### Phase 6: Flow Builder (P2)
> **Goal:** Cover flow CRUD, editor interactions, versions
> **Estimated tasks:** 5
> **Complexity:** Highest — ReactFlow canvas interactions

### Phase 7: TG Client & System (P2)
> **Goal:** Cover sessions, system status, webhooks
> **Estimated tasks:** 3

### Phase 8: Cross-Cutting & UX (P3)
> **Goal:** Pagination, search/filter, responsive, theme, errors, empty states
> **Estimated tasks:** 6

### Phase 9: CI/CD & Multi-Browser (P3)
> **Goal:** Automated pipeline, Firefox/WebKit
> **Estimated tasks:** 3

---

## 6. Detailed Task List

### Phase 0: Infrastructure Setup

#### TASK-0.1: Test Database Configuration
- **Goal:** Isolated database for E2E tests
- **Scope:** Add `postgres-test` service to `docker-compose.yml`, create `.env.test` files for API and frontend
- **Priority:** P0 — Blocker
- **Dependencies:** None
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - `docker compose up postgres-test` starts test DB on port 5433
  - `.env.test` exists for `apps/api` and `apps/frontend`
  - `DATABASE_URL` points to test DB in test env

#### TASK-0.2: Database Seed Script
- **Goal:** Reproducible test data across all models
- **Scope:** Create `packages/db/prisma/seed.ts` populating all 28 models with minimum viable data. Include: 3 users (normal, banned, admin-like), 3 categories (with parent-child), 5 products (mixed active/inactive/out-of-stock), 1 cart with items, 2 groups with configs and members, warnings, logs, 1 bot instance with commands/responses/menus, 2 flows (draft + active), 1 broadcast, 1 webhook endpoint, reputation scores.
- **Priority:** P0 — Blocker
- **Dependencies:** TASK-0.1
- **Complexity:** Medium (3-4h)
- **Definition of Done:**
  - `npx prisma db seed` populates all 28 models
  - Seed is idempotent (can re-run safely)
  - All seeded entities have deterministic, known IDs for assertions
  - Seed data documented in a comment block at top of file

#### TASK-0.3: Global Setup & Teardown
- **Goal:** Automated DB reset + seed before test suite
- **Scope:** Create `apps/frontend/e2e/global-setup.ts` and `global-teardown.ts`. Global setup: run migrations, seed DB. Global teardown: optional cleanup.
- **Priority:** P0 — Blocker
- **Dependencies:** TASK-0.2
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - `globalSetup` in `playwright.config.ts` references setup script
  - DB is migrated and seeded before any test runs
  - Tests start with known, predictable state

#### TASK-0.4: Enhanced Playwright Configuration
- **Goal:** Production-ready Playwright config
- **Scope:** Update `playwright.config.ts`: add `globalSetup`/`globalTeardown`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`, proper timeouts (`actionTimeout: 10000`, `expect.timeout: 5000`), output directory for artifacts, add `webServer` for API (start both API and frontend).
- **Priority:** P0 — Blocker
- **Dependencies:** TASK-0.3
- **Complexity:** Low (1h)
- **Definition of Done:**
  - Config starts both API (port 3000) and Frontend (port 3001)
  - Failures produce screenshots and videos
  - Traces captured on first retry
  - Timeouts are explicit and reasonable

#### TASK-0.5: API Helper Fixture
- **Goal:** Programmatic test data setup via API calls
- **Scope:** Create `apps/frontend/e2e/fixtures/api.ts` with helper class wrapping direct HTTP calls: `createProduct()`, `createCategory()`, `createFlow()`, `createBotInstance()`, `createBroadcast()`, etc. Authenticates with test token.
- **Priority:** P0
- **Dependencies:** TASK-0.1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - `ApiHelper` class with methods for all major entity CRUD
  - Used as a Playwright fixture (`apiHelper`)
  - Can create/delete test data without touching UI
  - Auth token obtained automatically

#### TASK-0.6: Page Object Models — Core
- **Goal:** Reusable page abstractions for common pages
- **Scope:** Create POM classes for: `LoginPage`, `SidebarComponent`, `ProductsPage`, `CategoriesPage`, `UsersPage`. Each POM encapsulates selectors and common actions (navigate, fill form, submit, verify).
- **Priority:** P0
- **Dependencies:** None
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - Each POM in `e2e/page-objects/`
  - Selectors use role/label/text (not CSS classes)
  - Common actions are methods (e.g., `productsPage.createProduct({...})`)
  - POMs are importable from test specs

#### TASK-0.7: Selective data-testid Attributes
- **Goal:** Add test-stable selectors where semantic selectors are insufficient
- **Scope:** Audit all list pages, tables, and forms. Add `data-testid` to: table rows (`data-testid="product-row-{id}"`), action buttons in table rows (`data-testid="delete-product-{id}"`), form containers, navigation items, confirmation dialog buttons. **Do NOT blanket-add testids** — only where `getByRole`/`getByText` would be ambiguous.
- **Priority:** P1
- **Dependencies:** TASK-0.6 (to identify gaps)
- **Complexity:** Medium (3-4h)
- **Definition of Done:**
  - Testids added to ambiguous elements (identified during POM creation)
  - Convention documented: `data-testid="{entity}-{element}-{id}"`
  - No functional changes to components
  - List of added testids maintained in `e2e/helpers/selectors.ts`

#### TASK-0.8: Test Data Factory
- **Goal:** Type-safe factory functions for generating test data
- **Scope:** Create `apps/frontend/e2e/helpers/test-data.factory.ts` with builder functions: `buildProduct()`, `buildCategory()`, `buildUser()`, etc. Each returns valid data objects with sensible defaults and overridable fields. Use unique timestamps/counters to avoid collisions.
- **Priority:** P1
- **Dependencies:** None
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - Factory for each major entity
  - Defaults produce valid API-compatible objects
  - Unique naming via timestamp suffix
  - Importable from any test spec

---

### Phase 1: Smoke & Auth Tests

#### TASK-1.1: Auth — Login Flow
- **Goal:** Verify login, redirect, token storage
- **Scope:** Tests in `e2e/auth/login.spec.ts`: successful login → redirect to `/dashboard`, wrong password → error message, empty password → validation, login page redirect if already authenticated.
- **Priority:** P0
- **Dependencies:** Phase 0
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 4 test cases passing
  - Covers happy path + 2 error cases + redirect

#### TASK-1.2: Auth — Session & Logout
- **Goal:** Verify session persistence and logout
- **Scope:** Tests in `e2e/auth/session.spec.ts`: refresh page stays authenticated, logout clears token and redirects to login, accessing `/dashboard` without token redirects to `/login`, expired token redirects to login.
- **Priority:** P0
- **Dependencies:** TASK-1.1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 4 test cases passing
  - Token lifecycle fully covered

#### TASK-1.3: Smoke — Dashboard Load
- **Goal:** Verify dashboard loads with all sections
- **Scope:** Tests in `e2e/smoke/smoke.spec.ts` (replace existing): login → dashboard shows KPIs/stats, sidebar renders all 9 sections, navigation to each top-level section works (doesn't 500).
- **Priority:** P0
- **Dependencies:** TASK-1.1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - Dashboard overview page loads with visible content
  - All sidebar sections present
  - Each section link navigates without error

#### TASK-1.4: Smoke — Critical Business Path
- **Goal:** Single test covering the most important end-to-end flow
- **Scope:** Login → create category → create product in that category → verify product appears in list → search for product → find it → delete product → verify gone. This is the "golden path" test.
- **Priority:** P0
- **Dependencies:** TASK-1.1, TASK-0.5
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - Single test exercising full CRUD lifecycle
  - Cleans up created data
  - Runs reliably without flakiness

---

### Phase 2: E-commerce CRUD

#### TASK-2.1: Products — Full CRUD
- **Goal:** Complete product lifecycle coverage
- **Scope:** Tests in `e2e/ecommerce/products.spec.ts`:
  - List: page loads, shows products from seed, pagination works
  - Create: fill form with all fields, submit, verify in list
  - Detail: navigate to product, verify all fields displayed
  - Edit: change fields, save, verify changes persisted
  - Delete: delete with confirmation dialog, verify removed from list
  - Validation: required fields, price ≥ 0, slug generation
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (3-4h)
- **Definition of Done:**
  - 8-10 test cases
  - All CRUD operations verified
  - Form validation tested
  - Pagination tested with seed data

#### TASK-2.2: Products — Search & Filters
- **Goal:** Verify product filtering UX
- **Scope:** Tests in `e2e/ecommerce/products.spec.ts` (continued):
  - Search by name: type query, verify filtered results
  - Category filter: select category, verify products match
  - Status filter: Active/Inactive toggle
  - Stock filter: In Stock / Out of Stock
  - Combined filters: search + category + status
  - Clear filters: reset shows all products
  - Pagination resets on filter change
- **Priority:** P1
- **Dependencies:** TASK-2.1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 6-7 test cases
  - All filter combinations work
  - Results match expected seed data

#### TASK-2.3: Categories — CRUD & Tree
- **Goal:** Category management including hierarchy
- **Scope:** Tests in `e2e/ecommerce/categories.spec.ts`:
  - List: tree view renders, parent-child hierarchy visible
  - Create: top-level and child category
  - Edit: change name, parent, sort order
  - Delete: delete leaf category (success), attempt delete with products (error)
  - Hierarchy: verify nested display
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 6-7 test cases
  - Tree hierarchy verified
  - Cascading constraints tested

#### TASK-2.4: Users — List & Actions
- **Goal:** User management coverage
- **Scope:** Tests in `e2e/ecommerce/users.spec.ts`:
  - List: shows users, stats visible, search works
  - Search: find user by username
  - Filter: All / Active / Banned
  - Detail: navigate to user, view profile
  - Ban: ban user with reason, verify status change
  - Unban: unban user, verify status change
  - Profile: view unified cross-app profile
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 7-8 test cases
  - Ban/unban lifecycle tested
  - Search and filter verified

#### TASK-2.5: Carts — View & Management
- **Goal:** Cart inspection coverage
- **Scope:** Tests in `e2e/ecommerce/carts.spec.ts`:
  - List: shows carts from seed
  - Detail: view cart items, quantities, totals
  - Actions: add item, update quantity, remove item, clear cart
- **Priority:** P2
- **Dependencies:** Phase 1, TASK-2.1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 4-5 test cases
  - Cart operations verified against API

#### TASK-2.6: Reputation — Leaderboard
- **Goal:** Reputation view coverage
- **Scope:** Tests in `e2e/ecommerce/reputation.spec.ts`:
  - Leaderboard loads with seeded data
  - Scores displayed correctly
  - Sorting by score
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 2-3 test cases
  - Read-only page renders correctly

---

### Phase 3: Moderation Features

#### TASK-3.1: Groups — List & Configuration
- **Goal:** Group management coverage
- **Scope:** Tests in `e2e/moderation/groups.spec.ts`:
  - List: groups display with search
  - Search: find group by name
  - Detail: view group config
  - Config: edit group settings, save, verify
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 5-6 test cases
  - Config form save/load verified

#### TASK-3.2: Members — Management Actions
- **Goal:** Member moderation actions
- **Scope:** Tests in `e2e/moderation/members.spec.ts`:
  - List members of a group
  - Release from quarantine
  - Change member role
  - Warn member
  - Mute member
  - Ban/unban member
- **Priority:** P1
- **Dependencies:** TASK-3.1
- **Complexity:** Medium (3h)
- **Definition of Done:**
  - 6 test cases (one per action)
  - Each action produces visible feedback (toast/status change)

#### TASK-3.3: Warnings — View & Deactivate
- **Goal:** Warning management coverage
- **Scope:** Tests in `e2e/moderation/warnings.spec.ts`:
  - List warnings for a group
  - View warning details
  - Deactivate a warning
  - Verify deactivated status
- **Priority:** P1
- **Dependencies:** TASK-3.1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 3-4 test cases
  - Deactivation workflow verified

#### TASK-3.4: Moderation Logs
- **Goal:** Log viewing and filtering
- **Scope:** Tests in `e2e/moderation/logs.spec.ts`:
  - List logs with seeded data
  - Filter by group
  - Filter by action type
  - Filter by date range
  - View stats
- **Priority:** P2
- **Dependencies:** TASK-3.1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 4-5 test cases
  - Multiple filter combinations verified

#### TASK-3.5: Scheduled Messages
- **Goal:** Scheduled message management
- **Scope:** Tests in `e2e/moderation/scheduled-messages.spec.ts`:
  - List scheduled messages
  - Create new scheduled message
  - Delete scheduled message
- **Priority:** P2
- **Dependencies:** TASK-3.1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 3 test cases
  - Create/delete lifecycle verified

---

### Phase 4: Automation & Broadcast

#### TASK-4.1: Broadcast — CRUD & Retry
- **Goal:** Broadcast message management
- **Scope:** Tests in `e2e/automation/broadcast.spec.ts`:
  - List broadcasts (paginated)
  - Create broadcast with message + targets
  - Edit pending broadcast
  - Delete broadcast with confirmation
  - Retry failed broadcast
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 5-6 test cases
  - Full lifecycle including retry

#### TASK-4.2: Automation Jobs & Health
- **Goal:** Automation monitoring views
- **Scope:** Tests in `e2e/automation/jobs.spec.ts`:
  - Health page loads with status indicators
  - Jobs list renders with seeded data
  - Job detail view
  - Stats display
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 3-4 test cases
  - Read-only views verified

#### TASK-4.3: Cross-Post Templates
- **Goal:** Template CRUD
- **Scope:** Tests in `e2e/automation/crosspost-templates.spec.ts`:
  - List templates
  - Create template
  - Edit template
  - Delete template
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 4 test cases
  - CRUD lifecycle verified

#### TASK-4.4: Order Events
- **Goal:** Order event management
- **Scope:** Tests in `e2e/automation/order-events.spec.ts`:
  - List order events
  - View event details
- **Priority:** P3
- **Dependencies:** Phase 1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 2 test cases
  - List page renders correctly

---

### Phase 5: Bot Configuration

#### TASK-5.1: Bot Instances — CRUD
- **Goal:** Bot instance management
- **Scope:** Tests in `e2e/bot-config/instances.spec.ts`:
  - List instances
  - Create new bot instance
  - Edit instance settings
  - Delete instance
  - View overview page
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 5 test cases
  - CRUD lifecycle verified

#### TASK-5.2: Bot Commands — CRUD & Reorder
- **Goal:** Command management including drag reorder
- **Scope:** Tests in `e2e/bot-config/commands.spec.ts`:
  - List commands for a bot
  - Create command
  - Edit command
  - Delete command
  - Reorder commands (if drag-and-drop, test via API fallback)
- **Priority:** P2
- **Dependencies:** TASK-5.1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 5 test cases
  - Reorder verified (at minimum via save + reload check)

#### TASK-5.3: Bot Responses & I18n
- **Goal:** Multi-locale response management
- **Scope:** Tests in `e2e/bot-config/responses.spec.ts`:
  - List responses (optionally filtered by locale)
  - Create response with specific locale
  - Edit response text
  - Delete response
  - Switch locale and verify different content
- **Priority:** P2
- **Dependencies:** TASK-5.1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 5-6 test cases
  - Locale switching verified

#### TASK-5.4: Bot Menus & Buttons
- **Goal:** Menu + button CRUD
- **Scope:** Tests in `e2e/bot-config/menus.spec.ts`:
  - List menus
  - Create menu
  - Add button to menu
  - Edit button
  - Delete button
  - Delete menu
- **Priority:** P2
- **Dependencies:** TASK-5.1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 6 test cases
  - Nested CRUD (menu → buttons) verified

---

### Phase 6: Flow Builder

#### TASK-6.1: Flow CRUD & Status
- **Goal:** Flow lifecycle management
- **Scope:** Tests in `e2e/flows/flow-crud.spec.ts`:
  - List flows (card grid)
  - Create new flow
  - Rename flow
  - Delete flow with confirmation
  - Activate/deactivate flow
  - Verify status badge changes
- **Priority:** P1
- **Dependencies:** Phase 1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 6-7 test cases
  - Status transitions verified
  - Replaces existing smoke test with more thorough coverage

#### TASK-6.2: Flow Editor — Canvas Interactions
- **Goal:** Visual editor core functionality
- **Scope:** Tests in `e2e/flows/flow-editor.spec.ts`:
  - Editor page loads with ReactFlow canvas
  - Node palette visible
  - Add node by drag-and-drop to canvas
  - Select node, verify properties panel
  - Connect two nodes (edge creation)
  - Save flow, reload, verify nodes persist
  - Delete node
- **Priority:** P2
- **Dependencies:** TASK-6.1
- **Complexity:** High (4-5h) — ReactFlow canvas interactions are complex
- **Definition of Done:**
  - 6-7 test cases
  - Canvas drag/drop reliable
  - Save/load roundtrip verified

**Assumption:** ReactFlow canvas interactions may need `page.mouse` API for drag operations. May require `data-testid` on canvas elements.

#### TASK-6.3: Flow Executions & Live View
- **Goal:** Execution history and monitoring
- **Scope:** Tests in `e2e/flows/flow-executions.spec.ts`:
  - Executions list loads (may be empty if no executions in seed)
  - Live view page loads
  - Navigation between flow tabs (edit, executions, live, versions, analytics)
- **Priority:** P2
- **Dependencies:** TASK-6.1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 3-4 test cases
  - Tab navigation verified
  - Empty state handled gracefully

#### TASK-6.4: Flow Versions
- **Goal:** Version management
- **Scope:** Tests in `e2e/flows/flow-versions.spec.ts`:
  - List versions (initial version from creation)
  - Create a version snapshot
  - Restore to previous version
  - Verify content after restore
- **Priority:** P2
- **Dependencies:** TASK-6.1
- **Complexity:** Medium (2-3h)
- **Definition of Done:**
  - 3-4 test cases
  - Create/restore version roundtrip verified

#### TASK-6.5: Flow Templates
- **Goal:** Template browsing
- **Scope:** Tests in `e2e/flows/flow-templates.spec.ts`:
  - Templates page loads
  - Template cards display
  - Use template to create new flow
- **Priority:** P3
- **Dependencies:** TASK-6.1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 2-3 test cases
  - Template → flow creation verified

---

### Phase 7: TG Client & System

#### TASK-7.1: TG Client Sessions
- **Goal:** Session management views
- **Scope:** Tests in `e2e/tg-client/sessions.spec.ts`:
  - Sessions list page loads
  - Session detail page loads
  - Deactivate session (if testable without real TG)
  - Health page loads with status
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 3-4 test cases
  - Read-only views verified
  - Actions tested where safe

**Assumption:** TG auth flow (`/tg-client/auth`) requires real Telegram credentials and cannot be E2E tested. Mock-only or skip.

#### TASK-7.2: System Status
- **Goal:** System health dashboard
- **Scope:** Tests in `e2e/system/status.spec.ts`:
  - Status page loads
  - Health indicators visible
  - No error states in normal conditions
- **Priority:** P3
- **Dependencies:** Phase 1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 2 test cases
  - Page renders without errors

#### TASK-7.3: Webhooks — CRUD
- **Goal:** Webhook endpoint management
- **Scope:** Tests in `e2e/system/webhooks.spec.ts`:
  - List webhooks
  - Create webhook
  - Verify URL generated
  - Delete webhook
- **Priority:** P2
- **Dependencies:** Phase 1
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 3-4 test cases
  - Create/delete lifecycle verified

---

### Phase 8: Cross-Cutting & UX

#### TASK-8.1: Pagination
- **Goal:** Verify pagination across all list pages
- **Scope:** Tests in `e2e/cross-cutting/pagination.spec.ts`:
  - Products: next/prev, page numbers, total display
  - Users: same
  - At least 3 different paginated pages
  - Page size respected (10 items)
  - URL state (if applicable)
- **Priority:** P2
- **Dependencies:** Phase 2
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 3-4 test cases across different pages
  - Navigation between pages works
  - Item counts correct

#### TASK-8.2: Search & Filter Behavior
- **Goal:** Cross-page search/filter UX verification
- **Scope:** Tests in `e2e/cross-cutting/search-filter.spec.ts`:
  - Debounced search (type → results update after pause)
  - Empty search results → empty state
  - Filter + search combination
  - Clear search/filter restores full list
- **Priority:** P2
- **Dependencies:** Phase 2
- **Complexity:** Low (1-2h)
- **Definition of Done:**
  - 4 test cases
  - Debounce behavior verified (no instant request on each keystroke)

#### TASK-8.3: Theme Switching
- **Goal:** Dark/light theme toggle
- **Scope:** Tests in `e2e/cross-cutting/theme.spec.ts`:
  - Toggle to dark mode → `<html>` has `dark` class
  - Toggle to light mode → `dark` class removed
  - Theme persists after page reload
  - System preference respected
- **Priority:** P3
- **Dependencies:** Phase 1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - 3-4 test cases
  - localStorage persistence verified
  - No FOUC on reload

#### TASK-8.4: Error Handling
- **Goal:** Verify error states display correctly
- **Scope:** Tests in `e2e/cross-cutting/error-handling.spec.ts`:
  - API returns 404 → appropriate error message
  - API returns 500 → error alert displayed
  - Network error → connection status changes
  - Form validation errors display inline
  - Toast errors for failed CRUD operations
- **Priority:** P2
- **Dependencies:** Phase 2
- **Complexity:** Medium (2-3h) — may need MSW for simulating API errors
- **Definition of Done:**
  - 4-5 test cases
  - Error messages visible and descriptive
  - No unhandled errors in console

**Assumption:** Some error tests may require MSW or route interception to simulate API failures.

#### TASK-8.5: Empty States
- **Goal:** Verify empty state UX
- **Scope:** Tests in `e2e/cross-cutting/empty-states.spec.ts`:
  - Empty product list (no products) → empty state component
  - Empty search results → "No results" message
  - Empty cart → appropriate message
  - At least 3 different empty state pages
- **Priority:** P3
- **Dependencies:** Phase 2
- **Complexity:** Low (1-2h) — may need clean DB or API mocking
- **Definition of Done:**
  - 3-4 test cases
  - EmptyState component renders with action button

#### TASK-8.6: Responsive Layout (Mobile)
- **Goal:** Verify mobile viewport behavior
- **Scope:** Tests in `e2e/cross-cutting/responsive.spec.ts`:
  - Mobile viewport: sidebar hidden, hamburger visible
  - Open mobile sidebar → sheet overlay
  - Navigate via mobile sidebar → auto-close
  - Table → card view transformation (ResponsiveTable)
  - Forms usable on mobile
- **Priority:** P3
- **Dependencies:** Phase 2
- **Complexity:** Medium (2h)
- **Definition of Done:**
  - 4-5 test cases with mobile viewport (`{ viewport: { width: 375, height: 667 } }`)
  - Core workflows functional on mobile

---

### Phase 9: CI/CD & Multi-Browser

#### TASK-9.1: GitHub Actions Workflow
- **Goal:** Automated E2E test pipeline
- **Scope:** Create `.github/workflows/e2e.yml`:
  - Trigger: PR to main, push to main
  - PostgreSQL service container
  - Steps: checkout → install → generate Prisma → migrate → seed → start API → run Playwright
  - Artifacts: upload HTML report, screenshots, traces
  - Caching: pnpm store, Playwright browsers
- **Priority:** P1
- **Dependencies:** Phase 1 (minimum viable tests exist)
- **Complexity:** Medium (3-4h)
- **Definition of Done:**
  - Workflow runs on PR
  - Tests pass in CI
  - Report uploaded as artifact
  - Failure blocks PR merge

#### TASK-9.2: Multi-Browser Projects
- **Goal:** Cross-browser coverage
- **Scope:** Add Firefox and WebKit projects to `playwright.config.ts`. Run critical smoke tests on all 3 browsers, full suite on Chromium only (to save CI time).
- **Priority:** P3
- **Dependencies:** TASK-9.1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - Config has 3 browser projects
  - Smoke tests tagged for multi-browser
  - CI runs all browsers for smoke, Chromium for full suite

#### TASK-9.3: Test Reporting & Monitoring
- **Goal:** Structured test reporting
- **Scope:** Add `@playwright/test` list reporter for CI, configure HTML reporter output path, add Slack notification on failure (optional), configure test retry strategy (2 retries in CI).
- **Priority:** P3
- **Dependencies:** TASK-9.1
- **Complexity:** Low (1h)
- **Definition of Done:**
  - CI produces readable test summary
  - HTML report accessible as artifact
  - Retry strategy documented

---

## 7. Technical Recommendations

### 7.1 Selector Strategy

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1st | `getByRole('button', { name: 'Save' })` | All interactive elements |
| 2nd | `getByLabel('Product Name')` | Form fields with labels |
| 3rd | `getByPlaceholder('Search...')` | Search inputs |
| 4th | `getByText('No products found')` | Static text content |
| 5th | `data-testid="product-row-123"` | Ambiguous elements in lists |

**Avoid:** CSS class selectors, `nth-child`, XPath, `page.locator('.some-class')`.

### 7.2 Test Isolation

- Each test file should be independently runnable (`fullyParallel: true`)
- Use `test.beforeEach` for per-test setup via API helpers (not UI)
- Use `test.afterEach` for cleanup of created entities
- Seed data provides baseline; tests create additional data as needed
- Never depend on execution order between test files

### 7.3 Flakiness Prevention

- Use `await expect(...).toBeVisible()` before interacting
- Use `page.waitForURL()` after navigation actions
- Use `page.waitForResponse()` for API-dependent UI updates
- Add `{ timeout: 10000 }` for slow operations (save, create)
- Use `toPass()` for eventually-consistent assertions
- Avoid `page.waitForTimeout()` — use condition-based waits

### 7.4 Test Tagging

```typescript
test('create product @smoke @p0', async ({ page }) => { ... });
test('filter by category @p1', async ({ page }) => { ... });
test('mobile layout @responsive @p3', async ({ page }) => { ... });
```

Run subsets: `npx playwright test --grep @smoke`

### 7.5 Performance

- Use API helpers for test setup instead of UI clicks
- Run independent test files in parallel
- Keep individual tests under 30 seconds
- Use `test.describe.configure({ mode: 'serial' })` only when tests share state

### 7.6 webServer Configuration

The Playwright config should start both the API and frontend servers:

```typescript
webServer: [
  {
    command: 'pnpm api start:dev',
    url: 'http://localhost:3000/api/system/status',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  {
    command: 'pnpm frontend dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
],
```

---

## 8. Risks, Gaps & Blockers

### Blockers

| # | Blocker | Impact | Mitigation |
|---|---------|--------|-----------|
| B1 | No test database isolation | Tests corrupt dev data | TASK-0.1: separate test DB |
| B2 | No seed scripts | Tests have no predictable starting state | TASK-0.2: create seed |
| B3 | API must be running for E2E | Tests depend on full stack | TASK-0.4: webServer config |

### Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | ReactFlow canvas interactions flaky | High | Flow editor tests unreliable | Use API setup for flow data, minimal UI interaction on canvas |
| R2 | WebSocket tests timing-dependent | Medium | False failures in CI | Use `waitForEvent` with generous timeout, or mock WS |
| R3 | No `data-testid` makes selectors fragile | Medium | Tests break on text changes | Add testids selectively (TASK-0.7) |
| R4 | Seed data drift from schema | Medium | Seed fails after migrations | Include seed in migration CI step |
| R5 | CI resource constraints | Low | Slow or failing CI | Single browser, parallel off in CI |
| R6 | TG Client auth requires real credentials | High | Cannot test auth flow | Skip TG auth tests; test only read-only views |
| R7 | Missing CI/CD infrastructure | High | No automated regression | TASK-9.1 as high priority |

### Gaps

| # | Gap | Notes |
|---|-----|-------|
| G1 | No accessibility testing | Consider `@axe-core/playwright` in future |
| G2 | No visual regression testing | Consider Playwright visual comparisons in future |
| G3 | No performance testing | Consider Lighthouse CI in future |
| G4 | No API contract testing | API unit tests exist but no contract validation |
| G5 | No role-based testing | Only single admin role exists; no multi-role scenarios |
| G6 | WebSocket real-time tests | Moderation feed, job progress — need WS event simulation |

### Assumptions

| # | Assumption |
|---|-----------|
| A1 | `DASHBOARD_SECRET=admin` is the test password (matches existing fixture) |
| A2 | API runs on port 3000, frontend on port 3001 in test environment |
| A3 | PostgreSQL is available locally (docker-compose) |
| A4 | No external service dependencies needed for E2E (TG bots, Trigger.dev) |
| A5 | Single-user testing is sufficient (no concurrent user scenarios) |
| A6 | Seed data provides enough entities for pagination tests (>10 items per entity) |
| A7 | ReactFlow library provides stable DOM structure for canvas testing |
| A8 | All CRUD operations are synchronous from UI perspective (no background jobs needed) |

---

## 9. Proposed Execution Order

### Priority Matrix

```
         HIGH BUSINESS VALUE          LOW BUSINESS VALUE
HIGH    ┌────────────────────┐       ┌────────────────────┐
RISK    │ Phase 0 (Infra)    │       │ Phase 6 (Flows)    │
        │ Phase 1 (Auth)     │       │                    │
        └────────────────────┘       └────────────────────┘
LOW     ┌────────────────────┐       ┌────────────────────┐
RISK    │ Phase 2 (E-comm)   │       │ Phase 7 (TG/Sys)   │
        │ Phase 3 (Moderate) │       │ Phase 8 (UX)       │
        │ Phase 4 (Automate) │       │ Phase 9 (CI)       │
        └────────────────────┘       └────────────────────┘
```

### Recommended Order

```
Week 1:  Phase 0 (Infrastructure) ──────────────── MUST DO FIRST
         ↓
Week 2:  Phase 1 (Smoke & Auth) ─────────────────── Validates infra works
         ↓
Week 2:  Phase 9.1 (CI/CD) ──────────────────────── Get CI running early
         ↓
Week 3:  Phase 2 (E-commerce) ───────────────────── Highest business value
         ↓
Week 3:  Phase 3 (Moderation) ───────────────────── Second highest value
         ↓
Week 4:  Phase 4 (Automation) ───────────────────── Complete core features
         ↓
Week 4:  Phase 5 (Bot Config) ───────────────────── Configuration coverage
         ↓
Week 5:  Phase 6 (Flow Builder) ─────────────────── Complex but important
         ↓
Week 5:  Phase 7 (TG Client & System) ──────────── Lower priority views
         ↓
Week 6:  Phase 8 (Cross-Cutting) ────────────────── UX polish
         ↓
Week 6:  Phase 9.2-9.3 (Multi-browser, Reporting)── Final polish
```

### Test Count Summary

| Phase | Test Files | Estimated Tests | Priority |
|-------|-----------|----------------|----------|
| Phase 0 | 0 (infra only) | 0 | P0 |
| Phase 1 | 4 | 12-16 | P0 |
| Phase 2 | 6 | 30-38 | P1 |
| Phase 3 | 5 | 20-25 | P1-P2 |
| Phase 4 | 4 | 14-17 | P1-P3 |
| Phase 5 | 4 | 20-24 | P2 |
| Phase 6 | 5 | 18-24 | P1-P3 |
| Phase 7 | 3 | 8-10 | P2-P3 |
| Phase 8 | 6 | 21-26 | P2-P3 |
| Phase 9 | 3 (CI config) | 0 | P1-P3 |
| **Total** | **40** | **143-180** | |

### Quick Wins (First 2 Weeks)

After Phase 0 + Phase 1, you'll have:
- Isolated test environment
- 12-16 tests covering auth + navigation + golden path CRUD
- CI pipeline running tests on every PR
- Foundation for all subsequent phases

### Full Coverage Milestone

After all phases, you'll have:
- ~160 E2E tests across 40 test files
- All CRUD operations covered
- Search, filter, pagination verified
- Error states and empty states tested
- Mobile responsive layout verified
- Multi-browser coverage (smoke)
- Automated CI/CD with reporting
