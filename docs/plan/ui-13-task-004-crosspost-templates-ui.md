# Task: Cross-Post Template Management UI

## Summary
Build a dashboard page for managing cross-post templates (create, edit, delete, view), with corresponding API endpoints.

## Problem
Cross-post templates are managed only through bot commands (`/crosspost create`, `/crosspost list`, `/crosspost delete`). The bot command interface is awkward for composing long messages and selecting multiple target groups. The CrossPostTemplate Prisma model exists but has no API.

## Goal
A web-based template management interface where admins can create, edit, and view cross-post templates with multi-group target selection.

## Scope
In scope:
- New NestJS API module: `apps/api/src/moderation/crosspost/`
- Dashboard page: `/dashboard/moderation/crosspost-templates`
- Template list with name, target count, active status
- Create/edit form: name, message text, target group selection (multi-select), active toggle
- Delete action with confirmation

Out of scope:
- Executing cross-posts from the dashboard (keep as bot command or future task)
- Message preview with Telegram formatting
- Template scheduling (use scheduled messages for timing)

## Requirements
- Functional:
  - List all templates with columns: name, message preview, target group count, active/inactive badge
  - Create template: name input, message textarea, multi-select groups, active toggle
  - Edit template: same form pre-filled
  - Delete template with confirmation
  - Toggle active/inactive
- Technical:
  - API: GET /api/moderation/crosspost-templates, POST, PATCH /:id, DELETE /:id
  - CrossPostTemplate model uses BigInt[] for targetChatIds — need to resolve to group names for display
  - Frontend: API client extensions

## Dependencies
- Task 010 (auth) — before write operations
- Existing: CrossPostTemplate model, ManagedGroup model for group name resolution

## Proposed approach

### Backend
1. Create `src/moderation/crosspost/` module
2. CRUD controller + service
3. Join with ManagedGroup to resolve chatId → group name for display

### Frontend
1. Create template list page
2. Create/edit dialog with message composer
3. Multi-select group picker component (checkboxes from managed groups)

## Deliverables
- `apps/api/src/moderation/crosspost/` — NestJS CRUD module
- `apps/frontend/src/app/dashboard/moderation/crosspost-templates/page.tsx`
- Updated `lib/api.ts` — CrossPostTemplate interfaces and methods

## Acceptance criteria
- [ ] API: CRUD operations work for CrossPostTemplate
- [ ] Frontend: Template list displays all templates
- [ ] Frontend: Create form allows name, text, group selection
- [ ] Frontend: Edit form loads existing template data
- [ ] Frontend: Delete has confirmation dialog
- [ ] Frontend: Active/inactive toggle works inline
- [ ] Group names display instead of raw chatIds

## Risks / Open questions
- CrossPostTemplate stores targetChatIds as BigInt[]. Need to map these to ManagedGroup titles for display.
- Should template editing be inline or in a separate page/dialog?
- Executing a template from the dashboard is a future extension — this task is CRUD only.

## Notes
CrossPostTemplate model: id, name (unique), messageText, targetChatIds (BigInt[]), isActive, createdBy (BigInt), createdAt, updatedAt.

## Implementation Notes
- Created NestJS API module at `apps/api/src/moderation/crosspost/`:
  - `crosspost.controller.ts` — GET / (paginated, isActive filter), GET /:id, POST /, PATCH /:id, DELETE /:id (204)
  - `crosspost.service.ts` — CRUD with BigInt→string conversion, resolves targetChatIds to group names via ManagedGroup lookup
  - `dto/crosspost-template.dto.ts` — CrossPostTemplateDto (includes targetGroupNames), CreateCrossPostTemplateDto, UpdateCrossPostTemplateDto
  - `crosspost.module.ts` — NestJS module
- Registered in `apps/api/src/moderation/moderation.module.ts`
- Added interfaces and API methods to `apps/frontend/src/lib/api.ts`
- Created page at `apps/frontend/src/app/dashboard/automation/crosspost-templates/page.tsx`:
  - Table with Name, Message preview, Target Groups count, Active badge, Actions
  - Create/edit form with group multi-select checkboxes, active toggle
  - Inline delete confirmation
  - Active/inactive toggle via PATCH
  - Pagination
- Added "Cross-post" nav entry with Copy icon under Automation section in sidebar
- Page placed under `/dashboard/automation/` (not moderation) since crossposting is an automation feature

## Validation Notes
- `pnpm api build` passes
- `pnpm frontend build` passes with `/dashboard/automation/crosspost-templates` route
- All existing routes unaffected

## Status
Completed
