# Issue #013: Flows Global Analytics Route Collision with :id Parameter

**Date:** 2026-03-10
**Severity:** High
**Status:** Fixed
**Component:** API (NestJS) — FlowsController

## Description

`GET /api/flows/analytics` returns 404 with message "Flow analytics not found" because NestJS routes it to the `@Get(':id')` handler instead of the `@Get('analytics')` handler. The `:id` handler treats "analytics" as a flow ID, fails to find it in the database, and throws `NotFoundException`.

## Affected Frontend Pages

- `/dashboard/flows/analytics` — Shows "Failed to load analytics"

## Steps to Reproduce

1. Navigate to `http://localhost:3001/dashboard/flows/analytics`
2. See "Failed to load analytics" error
3. API returns: `{"message":"Flow analytics not found","error":"Not Found","statusCode":404}`

## Root Cause

In `apps/api/src/flows/flows.controller.ts`, while `@Get('analytics')` (line 28) is declared before `@Get(':id')` (line 53), NestJS is still routing `/api/flows/analytics` to the parameterized `:id` handler. This is a known NestJS routing behavior where parameterized routes can shadow static routes.

## Fix Options

1. **Move `@Get('analytics')` to a separate controller** or prefix it differently (e.g., `@Get('stats/global')`)
2. **Add route validation** to the `@Get(':id')` handler to reject known static routes like "analytics"
3. **Use a dedicated analytics controller** with `@Controller('api/flows/analytics')`
4. **Reorder methods** and ensure static routes are registered first, or use a route prefix to avoid collision
