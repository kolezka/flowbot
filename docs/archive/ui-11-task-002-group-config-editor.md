# Task: Full Group Configuration Editor

## Summary
Build a comprehensive group configuration editor on the group detail page, allowing admins to modify all GroupConfig fields through a tabbed form interface.

## Problem
The group detail page (`/dashboard/moderation/groups/[id]`) currently displays configuration as read-only badges/text. Admins must use bot commands (`/config key value`) in the Telegram group to change settings. This is slow, error-prone (no validation preview), and requires being in the group chat. The API endpoint `PATCH /api/moderation/groups/:id/config` already exists but the frontend doesn't use it for most fields.

## Goal
A full-featured configuration editor organized into logical tabs, allowing admins to modify all group settings from the dashboard with validation and preview.

## Scope
In scope:
- Tabbed form on group detail page with sections: Moderation, Anti-Spam, Welcome, CAPTCHA, AI Moderation, Notifications, Pipeline
- All GroupConfig fields editable
- Form validation matching backend constraints
- Save with optimistic UI update
- Success/error feedback

Out of scope:
- Creating new groups (groups are created when the bot joins)
- Deleting groups
- Real-time sync with bot (changes apply on next bot restart or config reload)

## Requirements
- Functional requirements:
  - **Moderation tab**: maxWarnings (number), warningExpiry (duration), muteOnWarn (toggle), muteDuration (duration), logChannelId (text)
  - **Anti-Spam tab**: antiSpam (toggle), antiFlood (toggle), floodLimit (number), floodWindow (number in seconds)
  - **Anti-Link tab**: antiLink (toggle), linkWhitelist (tag input for domains)
  - **Welcome tab**: welcomeEnabled (toggle), welcomeMessage (textarea with variable hints: {name}, {group}, {count})
  - **CAPTCHA tab**: captchaEnabled (toggle), captchaMode (select: button/math), captchaTimeout (number)
  - **AI Moderation tab**: aiModEnabled (toggle), aiModThreshold (slider 0.0-1.0)
  - **Notifications tab**: notificationEvents (multi-select checkboxes)
  - **Pipeline tab**: pipelineEnabled (toggle), pipelineDmTemplate (textarea), pipelineDeeplink (text)
- Technical: Use existing PATCH endpoint, Radix form components
- UX: Unsaved changes indicator, confirm before navigation away, disable save button when no changes

## Dependencies
- Task 001 (navigation) — recommended but not blocking
- Existing API endpoint: `PATCH /api/moderation/groups/:id/config`
- May need API endpoint extensions if some GroupConfig fields aren't exposed yet

## Proposed approach
1. Read the current GroupConfig model fields from Prisma schema
2. Create a `GroupConfigEditor` component with Radix Tabs
3. Each tab renders a form section using existing Input, Select, Checkbox components
4. Track dirty state with a simple useReducer or form state
5. PATCH on save, show toast on success/error
6. Replace current read-only config display on group detail page

## Deliverables
- `components/group-config-editor.tsx` — Tabbed config editor component
- Updated `dashboard/moderation/groups/[id]/page.tsx` — Integrate editor
- Updated `lib/api.ts` — Ensure all GroupConfig fields are in the interface

## Acceptance criteria
- [ ] All GroupConfig fields are editable through the form
- [ ] Changes are validated before submission
- [ ] Successful save shows confirmation feedback
- [ ] Failed save shows error message
- [ ] Form shows current values loaded from API
- [ ] Unsaved changes trigger a visual indicator
- [ ] Duration fields accept human-readable input (e.g., "1h", "30m")
- [ ] Toggle fields use proper switch/checkbox components

## Risks / Open questions
- Which GroupConfig fields are stored as JSON sub-objects vs. flat columns? Need to verify schema.
- Are all fields exposed via the existing PATCH endpoint, or do some need backend additions?
- Should config changes trigger an immediate bot reload, or wait for periodic refresh?

## Notes
The GroupConfig Prisma model has fields: maxWarnings, warningExpiry, muteOnWarn, muteDuration, antiSpam, antiFlood, floodLimit, floodWindow, welcomeEnabled, welcomeMessage, logChannelId, plus additional fields added in later phases (captcha, AI, pipeline, notifications). The API UpdateGroupConfigDto may need to be extended to cover all fields.

## Implementation Notes
- Updated `apps/frontend/src/lib/api.ts` GroupConfig interface to match all 29 API fields
- Rewrote `apps/frontend/src/app/dashboard/moderation/groups/[id]/page.tsx` with 8-tab config editor
- Tabs: Warnings, Anti-Spam, Anti-Link, Welcome & Rules, CAPTCHA, Content, Automation, Logging
- Created reusable TagInput component (inline) for array fields (antiLinkWhitelist, keywordFilters)
- CAPTCHA mode uses Radix Select component (button/math options)
- AI threshold uses number input with step=0.05, range 0-1
- Notification events use checkboxes for order_placed, order_shipped
- No backend changes needed — the API UpdateGroupConfigDto already supports all 29 fields
- Old field names (maxWarnings, warningExpiry, etc.) fully replaced with correct API names (warnThresholdMute, warnThresholdBan, etc.)
- Preserved Group Info card and Members/Warnings navigation links

## Validation Notes
- `pnpm frontend build` passes (22 routes, 0 errors)
- No references to old field names remain in frontend codebase
- All GroupConfig fields are editable through the tabbed form

## Status
Completed
