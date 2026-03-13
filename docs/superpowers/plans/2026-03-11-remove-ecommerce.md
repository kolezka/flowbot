# Remove E-Commerce Functionality — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all e-commerce code (Products, Categories, Cart, CartItem, OrderEvent) from the monorepo, leaving only group management, moderation, broadcast, flows, and bot-config functionality.

**Architecture:** The e-commerce domain spans 6 workspaces. Prisma models are already removed from the schema. Many source files are already deleted (unstaged). Remaining work is cleaning up references in: API automation module, frontend API client, frontend sidebar, telegram-transport package, trigger tests, e2e tests, API test mocks, and CLAUDE.md.

**Tech Stack:** NestJS, Next.js, grammY, Trigger.dev, Prisma, Valibot, Vitest/Jest

---

## Pre-Existing State

These files are **already deleted** (unstaged in git):
- `apps/api/src/cart/` (entire module)
- `apps/api/src/categories/` (entire module)
- `apps/api/src/products/` (entire module)
- `apps/bot/src/bot/features/products.ts`
- `apps/bot/src/bot/keyboards/products.ts`
- `apps/bot/src/bot/keyboards/cart.ts`
- `apps/bot/src/bot/callback-data/products.ts`
- `apps/frontend/src/app/dashboard/products/` (entire tree)
- `apps/frontend/src/app/dashboard/categories/` (entire tree)
- `apps/frontend/src/app/dashboard/carts/` (entire tree)
- `apps/frontend/src/app/dashboard/automation/order-events/` (page + loading)
- `apps/trigger/src/trigger/order-notification.ts`

These files are **already modified** (unstaged):
- `packages/db/prisma/schema.prisma` — e-commerce models removed
- `apps/api/src/app.module.ts` — ProductsModule/CategoriesModule/CartModule imports removed
- `apps/bot/src/bot/index.ts` — products feature import removed
- `apps/bot/src/bot/keyboards/menu.ts` — product/cart options removed
- `apps/bot/src/bot/callback-data/menu.ts` — product/cart callbacks removed
- `apps/bot/locales/en.ftl` — e-commerce i18n strings removed

## File Structure — Remaining Changes

| Action | File | What to change |
|--------|------|---------------|
| Modify | `apps/api/src/automation/automation.controller.ts` | Remove `createOrderEvent` and `getOrderEvents` endpoints |
| Modify | `apps/api/src/automation/automation.service.ts` | Remove `createOrderEvent`, `getOrderEvents`, `mapOrderEventToDto` methods |
| Modify | `apps/api/src/automation/dto/automation.dto.ts` | Remove `OrderEventDto`, `CreateOrderEventDto`, `OrderEventListResponseDto` classes |
| Modify | `apps/api/src/automation/automation.service.spec.ts` | Remove `createOrderEvent` and `getOrderEvents` test suites, remove `mockOrderEvent` |
| Modify | `apps/api/src/common/testing/prisma-mock.factory.ts` | Remove `orderEvent: createMockModel()` |
| Modify | `apps/frontend/src/components/sidebar.tsx` | Remove "E-commerce" section (keep Users under new location), remove "Order Events" link, remove unused icon imports |
| Modify | `apps/frontend/src/lib/api.ts` | Remove Product/Category/Cart/OrderEvent interfaces and all related API methods |
| Delete | `apps/frontend/e2e/products.spec.ts` | Entire file |
| Delete | `apps/frontend/e2e/categories.spec.ts` | Entire file |
| Modify | `apps/frontend/e2e/smoke.spec.ts` | Remove `/dashboard/products` entry |
| Modify | `apps/frontend/e2e/integration-smoke.spec.ts` | Remove product lifecycle test, remove products from navigation test |
| Modify | `apps/frontend/e2e/crud-interactions.spec.ts` | Remove Category and Product CRUD test suites |
| Modify | `apps/frontend/e2e/automation.spec.ts` | Remove order events test |
| Delete | `apps/trigger/src/__tests__/order-notification-logic.test.ts` | Entire file |
| Delete | `packages/telegram-transport/src/actions/executors/order-notification.ts` | Entire file |
| Modify | `packages/telegram-transport/src/actions/types.ts` | Remove `SEND_ORDER_NOTIFICATION` enum, `SendOrderNotificationPayload`, schema, and ActionSchema variant |
| Modify | `packages/telegram-transport/src/actions/runner.ts` | Remove order-notification import and switch case |
| Modify | `packages/telegram-transport/src/index.ts` | Remove `SendOrderNotificationPayload` and `executeOrderNotification` exports |
| Modify | `CLAUDE.md` | Update project description, model counts, remove e-commerce references |

---

## Chunk 1: API — Remove Order Events from Automation Module

### Task 1: Remove OrderEvent DTOs

**Files:**
- Modify: `apps/api/src/automation/dto/automation.dto.ts:57-106`

- [ ] **Step 1: Remove OrderEvent DTO classes**

Remove these classes from `apps/api/src/automation/dto/automation.dto.ts`:
- `OrderEventDto` (lines 57-78)
- `CreateOrderEventDto` (lines 80-89)
- `OrderEventListResponseDto` (lines 91-106)

Also remove their imports from `apps/api/src/automation/automation.service.ts` and `apps/api/src/automation/automation.controller.ts`.

- [ ] **Step 2: Verify file compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to automation DTOs (may have other errors until service/controller are cleaned)

### Task 2: Remove OrderEvent endpoints from controller

**Files:**
- Modify: `apps/api/src/automation/automation.controller.ts:108-138`

- [ ] **Step 1: Remove order-event endpoints**

Remove from `apps/api/src/automation/automation.controller.ts`:
- `createOrderEvent` method (lines 108-119) — `@Post('order-events')`
- `getOrderEvents` method (lines 121-138) — `@Get('order-events')`

Remove unused imports: `CreateOrderEventDto`, `OrderEventDto`, `OrderEventListResponseDto` from the DTO import.

### Task 3: Remove OrderEvent methods from service

**Files:**
- Modify: `apps/api/src/automation/automation.service.ts:2,10-13,129-176,233-243`

- [ ] **Step 1: Remove order-event methods**

Remove from `apps/api/src/automation/automation.service.ts`:
- `import { tasks } from '@trigger.dev/sdk/v3';` (line 2) — only if no other usage
- `CreateOrderEventDto`, `OrderEventDto`, `OrderEventListResponseDto` from DTO imports (lines 10-13)
- `createOrderEvent` method (lines 129-149)
- `getOrderEvents` method (lines 151-176)
- `mapOrderEventToDto` method (lines 233-243)

- [ ] **Step 2: Verify API compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

### Task 4: Remove OrderEvent tests from automation service spec

**Files:**
- Modify: `apps/api/src/automation/automation.service.spec.ts`

- [ ] **Step 1: Remove order-event test fixtures and suites**

Remove from `apps/api/src/automation/automation.service.spec.ts`:
- `mockOrderEvent` constant (around line 49)
- `orderEvent: createMockModel()` from prisma mock setup (around line 63)
- `describe('createOrderEvent', ...)` test suite (around line 179)
- `describe('getOrderEvents', ...)` test suite (around line 219)
- Any imports only used by order event tests (e.g., `tasks` from `@trigger.dev/sdk/v3`)

- [ ] **Step 2: Remove orderEvent from prisma mock factory**

Remove from `apps/api/src/common/testing/prisma-mock.factory.ts`:
- `orderEvent: createMockModel(),` (line 57)

- [ ] **Step 3: Run API tests**

Run: `cd /root/Development/tg-allegro && pnpm api test 2>&1 | tail -20`
Expected: All remaining tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/automation/ apps/api/src/common/testing/prisma-mock.factory.ts
git commit -m "feat: remove order-event endpoints and tests from automation module"
```

---

## Chunk 2: Telegram Transport — Remove Order Notification

### Task 5: Remove order-notification executor

**Files:**
- Delete: `packages/telegram-transport/src/actions/executors/order-notification.ts`

- [ ] **Step 1: Delete the order-notification executor file**

```bash
rm packages/telegram-transport/src/actions/executors/order-notification.ts
```

### Task 6: Remove order notification from types

**Files:**
- Modify: `packages/telegram-transport/src/actions/types.ts`

- [ ] **Step 1: Remove order notification types and schemas**

Remove from `packages/telegram-transport/src/actions/types.ts`:
- `SEND_ORDER_NOTIFICATION = 'SEND_ORDER_NOTIFICATION'` from `ActionType` enum (line 9)
- `SendOrderNotificationPayload` interface (lines 48-53)
- `SendOrderNotificationPayload` from the `ActionPayload` union type (line 55)
- `SendOrderNotificationPayloadSchema` Valibot schema (lines 99-104)
- The `SEND_ORDER_NOTIFICATION` variant from `ActionSchema` (lines 132-136)

### Task 7: Remove order notification from runner

**Files:**
- Modify: `packages/telegram-transport/src/actions/runner.ts`

- [ ] **Step 1: Remove order notification from runner**

Remove from `packages/telegram-transport/src/actions/runner.ts`:
- `SendOrderNotificationPayload` from the type import (line 2)
- `import { executeOrderNotification } from './executors/order-notification.js'` (line 12)
- The `case ActionType.SEND_ORDER_NOTIFICATION:` block (lines 185-190)

### Task 8: Remove order notification from package exports

**Files:**
- Modify: `packages/telegram-transport/src/index.ts`

- [ ] **Step 1: Remove exports**

Remove from `packages/telegram-transport/src/index.ts`:
- `SendOrderNotificationPayload` from the type export (line 24)
- `export { executeOrderNotification } from './actions/executors/order-notification.js'` (line 34)

- [ ] **Step 2: Run telegram-transport tests**

Run: `cd /root/Development/tg-allegro && pnpm telegram-transport test 2>&1 | tail -20`
Expected: All remaining tests pass

- [ ] **Step 3: Run typecheck**

Run: `cd /root/Development/tg-allegro && pnpm telegram-transport typecheck 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/telegram-transport/
git commit -m "feat: remove order-notification executor from telegram-transport"
```

---

## Chunk 3: Trigger — Remove Order Notification Test

### Task 9: Delete order-notification test

**Files:**
- Delete: `apps/trigger/src/__tests__/order-notification-logic.test.ts`

- [ ] **Step 1: Delete the test file**

```bash
rm apps/trigger/src/__tests__/order-notification-logic.test.ts
```

- [ ] **Step 2: Run trigger tests**

Run: `cd /root/Development/tg-allegro && pnpm trigger test 2>&1 | tail -20`
Expected: All remaining tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/trigger/
git commit -m "feat: remove order-notification trigger task and tests"
```

---

## Chunk 4: Frontend — Remove E-Commerce from Sidebar, API Client, and E2E Tests

### Task 10: Update sidebar navigation

**Files:**
- Modify: `apps/frontend/src/components/sidebar.tsx`

- [ ] **Step 1: Remove E-commerce section and Order Events link**

In `apps/frontend/src/components/sidebar.tsx`:

1. Remove the entire "E-commerce" section from the `navigation` array (lines 72-80). Move "Users" to a standalone top-level link:
```typescript
{
  label: "Users",
  icon: Users,
  href: "/dashboard/users",
},
```

2. Remove the "Order Events" entry from the "Automation" children (line 119):
```typescript
{ label: "Order Events", href: "/dashboard/automation/order-events", icon: Package },
```

3. Remove unused icon imports: `ShoppingBag`, `ShoppingCart`, `FolderTree`. Keep `Package` only if still used elsewhere (check "Order Events" was the only user — if so, remove it too).

### Task 11: Remove e-commerce types and methods from API client

**Files:**
- Modify: `apps/frontend/src/lib/api.ts`

- [ ] **Step 1: Remove e-commerce interfaces**

Remove from `apps/frontend/src/lib/api.ts`:
- `Product` interface (lines 46-63)
- `ProductsResponse` interface (lines 65-71)
- `CreateProductDto` interface (lines 73-86)
- `UpdateProductDto` interface (line 88)
- `Category` interface (lines 90-104)
- `CategoryTreeNode` interface (lines 106-117)
- `CategoriesResponse` interface (lines 119-125)
- `CartItem` interface (lines 127-136)
- `Cart` interface (lines 138-147)
- `CartsResponse` interface (lines 149-155)
- `OrderEvent` interface (lines 553-561)
- `OrderEventListResponse` interface (lines 563-567)

- [ ] **Step 2: Remove e-commerce API methods**

Remove from the `ApiClient` class in `apps/frontend/src/lib/api.ts`:
- `getProducts` method (lines 920-937)
- `getProduct` method (lines 940-941)
- `createProduct` method (lines 944-949)
- `updateProduct` method (lines 951-956)
- `deleteProduct` method (lines 958-962)
- `getCategoryTree` method (lines 965-967)
- `getAllCategories` method (lines 970-983)
- `getCategory` method (lines 984-985)
- `createCategory` method (lines 988-993)
- `updateCategory` method (lines 995-1000)
- `deleteCategory` method (lines 1002-1006)
- `getCart` method (lines 1009-1010)
- `getAllCarts` method (lines 1013-1019)
- `clearCart` method (lines 1022-1026)
- `addCartItem` method (lines 1028-1033)
- `updateCartItem` method (lines 1035-1040)
- `removeCartItem` method (lines 1042-1046)
- `getOrderEvents` method (lines 1340-1349)

### Task 12: Remove e-commerce E2E test files

**Files:**
- Delete: `apps/frontend/e2e/products.spec.ts`
- Delete: `apps/frontend/e2e/categories.spec.ts`

- [ ] **Step 1: Delete dedicated e-commerce test files**

```bash
rm apps/frontend/e2e/products.spec.ts
rm apps/frontend/e2e/categories.spec.ts
```

### Task 13: Clean up e-commerce references in remaining E2E tests

**Files:**
- Modify: `apps/frontend/e2e/smoke.spec.ts`
- Modify: `apps/frontend/e2e/integration-smoke.spec.ts`
- Modify: `apps/frontend/e2e/crud-interactions.spec.ts`
- Modify: `apps/frontend/e2e/automation.spec.ts`

- [ ] **Step 1: Remove products entry from smoke test**

In `apps/frontend/e2e/smoke.spec.ts`, remove:
```typescript
{ path: '/dashboard/products', text: /products/i },
```

- [ ] **Step 2: Remove product lifecycle test from integration-smoke**

In `apps/frontend/e2e/integration-smoke.spec.ts`:
- Remove the `'product lifecycle: create → list → search → delete'` test (around line 103)
- Remove `/dashboard/products` from the navigation test entries (around line 232)

- [ ] **Step 3: Remove Category and Product CRUD tests**

In `apps/frontend/e2e/crud-interactions.spec.ts`:
- Remove `test.describe('Category CRUD lifecycle', ...)` block (around line 3)
- Remove `test.describe('Product CRUD lifecycle', ...)` block (around line 33)
- If the file becomes empty, delete it entirely.

- [ ] **Step 4: Remove order events test from automation spec**

In `apps/frontend/e2e/automation.spec.ts`:
- Remove the `'order events page loads'` test (around line 40)

- [ ] **Step 5: Verify frontend builds**

Run: `cd /root/Development/tg-allegro && pnpm frontend build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/
git commit -m "feat: remove e-commerce UI, API client methods, sidebar links, and e2e tests"
```

---

## Chunk 5: Database, Docs, and Final Cleanup

### Task 14: Regenerate Prisma client

- [ ] **Step 1: Regenerate Prisma client (removes stale generated types)**

Run: `cd /root/Development/tg-allegro && pnpm db generate && pnpm db build`
Expected: Prisma client regenerates without Product/Category/Cart/CartItem/OrderEvent types

### Task 15: Create database migration

- [ ] **Step 1: Create migration to drop e-commerce tables**

Run: `cd /root/Development/tg-allegro && pnpm db prisma:migrate -- --name remove-ecommerce-tables`
Expected: Migration file created that drops Product, Category, Cart, CartItem, OrderEvent tables

**WARNING:** This migration is destructive. Review the generated SQL before applying to any non-dev database.

### Task 16: Stage all pre-existing deletions

- [ ] **Step 1: Stage all already-deleted and already-modified files**

```bash
git add apps/api/src/cart/ apps/api/src/categories/ apps/api/src/products/
git add apps/api/src/app.module.ts
git add apps/bot/
git add apps/frontend/src/app/dashboard/products/ apps/frontend/src/app/dashboard/categories/ apps/frontend/src/app/dashboard/carts/ apps/frontend/src/app/dashboard/automation/order-events/
git add apps/trigger/src/trigger/order-notification.ts
git add packages/db/
```

### Task 17: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update project description**

In `CLAUDE.md`:
- Update "28 Prisma models" count (subtract 5: Product, Category, Cart, CartItem, OrderEvent → 23 models)
- Update "80+ API endpoints" count (subtract ~15 e-commerce endpoints)
- Remove e-commerce references from "Domains" section: remove `E-commerce (User, Category, Product, Cart, CartItem)` — keep `User` but move it to Cross-app
- Remove "OrderEvent" from Cross-app domain list
- Update "7 Trigger.dev tasks" to "6 Trigger.dev tasks"
- Remove mention of `order-notification` from Trigger task list in App Structure section

- [ ] **Step 2: Final commit**

```bash
git add CLAUDE.md
git add -A  # catch any remaining unstaged deletions
git commit -m "feat: complete e-commerce removal — drop models, pages, endpoints, tests, and docs"
```

### Task 18: Verify everything works

- [ ] **Step 1: Run API tests**

Run: `pnpm api test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 2: Run telegram-transport tests**

Run: `pnpm telegram-transport test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 3: Run trigger tests**

Run: `pnpm trigger test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 4: Build API**

Run: `pnpm api build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Build frontend**

Run: `pnpm frontend build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 6: Typecheck telegram-transport**

Run: `pnpm telegram-transport typecheck 2>&1 | tail -10`
Expected: No errors
