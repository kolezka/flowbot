# Issue #014: Missing GET /api/moderation/groups Endpoint

**Date:** 2026-03-10
**Severity:** Medium
**Status:** Fixed
**Component:** API (NestJS)

## Description

The frontend requests `GET /api/moderation/groups?limit=100` to populate group selection dropdowns on multiple pages, but no controller serves this endpoint. Only `GET /api/moderation/groups/:groupId/members` exists in the MembersController.

## Affected Frontend Pages

- `/dashboard/automation/crosspost-templates` — Group selection checkboxes don't load
- `/dashboard/moderation/scheduled-messages` — Group filter dropdown only shows "All Groups"

## Steps to Reproduce

1. Navigate to `http://localhost:3001/dashboard/automation/crosspost-templates`
2. Click "New Template"
3. No groups appear in the group selection
4. Console shows `404 Not Found` for `http://localhost:3000/api/moderation/groups?limit=100`

## Root Cause

No controller defines a `GET /api/moderation/groups` endpoint. The `ManagedGroup` model exists in the Prisma schema, but there's no groups listing controller.

## Fix

Create a groups controller or add a `findAll` route to an existing moderation controller:

```typescript
@Controller('api/moderation/groups')
export class GroupsController {
  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.service.findAll(limit ? parseInt(limit) : 100);
  }
}
```
