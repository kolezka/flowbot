# Issue #015: Trigger.dev Config Has Wrong Project Reference

**Date:** 2026-03-10
**Severity:** High
**Status:** Fixed (during QA)
**Component:** Trigger.dev Worker

## Description

The `trigger.config.ts` file contained the project reference `proj_trigger_flowbot` which does not exist on the self-hosted Trigger.dev instance at `trigger.raqz.link`. The actual project ref is `proj_hilpmfmsfxxbgutxovgl`.

## Error Message

```
ERROR: Failed to initialize dev environment: 404 "Project not found". Using project ref proj_trigger_flowbot
```

## Fix Applied

Changed `apps/trigger/trigger.config.ts`:
```typescript
// Before
project: "proj_trigger_flowbot",
// After
project: "proj_hilpmfmsfxxbgutxovgl",
```

## Notes

- The worker starts successfully after the fix
- The project ref should match the project created on the self-hosted Trigger.dev dashboard
- Consider using an environment variable for the project ref to avoid hardcoding
