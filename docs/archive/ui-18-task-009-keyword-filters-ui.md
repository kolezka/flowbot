# Task: Keyword Filter Management UI

## Summary
Build a keyword filter management interface on the group detail page, allowing admins to add, remove, and view keyword filters from the dashboard.

## Problem
Keyword filters are managed only through bot commands (`/filter add <word>`, `/filter remove <word>`, `/filter list`). There's no overview of all filters across groups, and managing many filters via chat commands is tedious. The filters are stored in GroupConfig (likely as a JSON field or comma-separated string).

## Goal
A filter management section on the group detail page with add/remove functionality and a clear list view.

## Scope
In scope:
- Filter list display on group detail page
- Add filter input (word or phrase)
- Remove filter action (click-to-remove with confirmation)
- Bulk operations would be nice but not required
- API endpoint for filter CRUD (may use existing GroupConfig PATCH or new endpoints)

Out of scope:
- Regex-based filters (keep it simple: exact/substring match)
- Filter testing ("would this message be caught?")
- Filter import/export

## Requirements
- Functional:
  - Display all keyword filters for a group
  - Add new filter word/phrase
  - Remove existing filter
  - Show filter count badge
- Technical:
  - Determine where filters are stored (GroupConfig JSON field vs. separate model)
  - API: May use PATCH /api/moderation/groups/:id/config or new dedicated endpoint
- UX:
  - Tag/chip display for filters (click X to remove)
  - Input field with "Add" button
  - Confirmation before removal

## Dependencies
- Task 002 (group config editor) — filters section could be a tab within the config editor
- Need to verify how keyword filters are stored in the database

## Proposed approach
1. Check how the bot stores filters (likely in GroupConfig as a JSON array field or separate list)
2. If stored in GroupConfig: add a "Filters" tab to the config editor (Task 002)
3. If stored separately: create dedicated API endpoints
4. Use a tag/chip input component for adding and displaying filters
5. Each filter shows as a removable badge/tag

## Deliverables
- Filter section in group config editor or standalone component
- API support for filter CRUD
- Updated group detail page

## Acceptance criteria
- [ ] All existing filters for a group are displayed
- [ ] New filters can be added via input field
- [ ] Existing filters can be removed
- [ ] Changes are persisted to the database
- [ ] Filter count is visible at a glance

## Risks / Open questions
- How exactly are filters stored? Need to inspect the bot's filter feature code and GroupConfig model.
- Are filters case-sensitive or case-insensitive? The bot uses case-insensitive matching — UI should indicate this.
- Should this be a standalone page or a tab within the group config editor (Task 002)?

## Notes
The filters feature is at `apps/manager-bot/src/bot/features/filters.ts`. Need to read this file to understand storage format before implementing.

## Implementation Notes
- Keyword filters are stored as `keywordFilters: String[]` in the GroupConfig model
- Task 002 (Group Config Editor) already implemented a TagInput component for this field on the "Content" tab
- The `keywordFiltersEnabled` toggle and `keywordFilters` tag input are fully functional
- No additional work needed — this task is fully covered by Task 002's implementation

## Status
Completed (covered by Task 002)
