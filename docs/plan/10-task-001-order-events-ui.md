# Task: Order Event Monitoring Dashboard

## Summary
Build a frontend page to view and monitor OrderEvent records, showing order notification delivery status across groups.

## Problem
The tg-client sends order notifications (order_placed, order_shipped) to configured group chats when e-commerce events occur. The OrderEvent Prisma model and API endpoint (`GET /api/automation/order-events`) both exist and are functional, but there is zero frontend visibility. Operators cannot verify whether notifications were delivered, see failures, or track which orders triggered notifications. This data is completely hidden from the dashboard.

## Goal
A dashboard page showing all order events with filtering, status indicators, and delivery details.

## Scope
In scope:
- New page at `/dashboard/automation/order-events`
- Table with columns: event type, order data preview, target groups, processed status, created date
- Filter by event type (order_placed, order_shipped)
- Filter by processed status (true/false)
- Expandable rows showing full order data JSON and target chat IDs
- Pagination
- Nav entry in sidebar under Automation section

Out of scope:
- Creating order events from the dashboard (events originate from the e-commerce bot)
- Editing or deleting order events
- Real-time push updates

## Requirements
- Functional: List all order events with type, status, and date filters; expandable detail view; pagination
- Technical: Use existing `GET /api/automation/order-events` endpoint; add OrderEvent interfaces to `lib/api.ts`; add `getOrderEvents()` method to ApiClient
- UX: Color-coded status badges (processed=green, pending=yellow); truncated order data in table, full JSON in expanded view
- Integration: Add "Order Events" nav link under Automation section in sidebar

## Dependencies
- API endpoint already exists: `GET /api/automation/order-events`
- Automation controller already handles this (apps/api/src/automation/automation.controller.ts)
- No backend changes needed

## Proposed approach
1. Add `OrderEvent` and `OrderEventListResponse` interfaces to `apps/frontend/src/lib/api.ts`
2. Add `getOrderEvents(params)` method to ApiClient
3. Create `apps/frontend/src/app/dashboard/automation/order-events/page.tsx` following the automation/jobs page pattern
4. Add "Order Events" nav entry in sidebar under Automation section with `Package` icon from lucide-react

## Deliverables
- Updated `apps/frontend/src/lib/api.ts` — OrderEvent interfaces and API method
- New `apps/frontend/src/app/dashboard/automation/order-events/page.tsx` — Order events page
- Updated `apps/frontend/src/components/sidebar.tsx` — New nav entry

## Acceptance criteria
- [ ] Order events page shows all events with pagination
- [ ] Event type filter works (order_placed, order_shipped)
- [ ] Processed status filter works
- [ ] Expandable rows show full order data JSON
- [ ] Color-coded status badges display correctly
- [ ] Page is accessible from sidebar navigation
- [ ] `pnpm frontend build` passes

## Risks / Open questions
- OrderEvent fields include `targetChatIds` as BigInt[]. Need to verify API serialization matches frontend expectations (string[] in JSON).
- How much order data is in the `orderData` JSON field? May need formatted display rather than raw JSON dump.

## Notes
The OrderEvent model: id, eventType (String), orderData (Json), targetChatIds (BigInt[]), jobId (String?, reference to automation job), processed (Boolean), createdAt. The API endpoint is at `GET /api/automation/order-events` with pagination and optional `processed` filter.
