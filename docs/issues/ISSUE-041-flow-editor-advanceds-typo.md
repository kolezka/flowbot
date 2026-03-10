# ISSUE-041 — Flow editor Node Palette displays "ADVANCEDS" instead of "ADVANCED"

**Severity:** low
**Area:** ui
**Discovered in phase:** Phase 2 — UI Testing

---

## Description

In the Flow Editor's Node Palette, the category heading for advanced nodes displays "ADVANCEDS" instead of "ADVANCED". All other category headings are also pluralized naively ("TRIGGERS", "CONDITIONS", "ACTIONS") which works for those words, but "advanced" + "s" = "advanceds" is grammatically incorrect.

---

## Steps to Reproduce
1. Navigate to http://localhost:3001/dashboard/flows
2. Click on any flow card (e.g., "QA Test Flow")
3. Look at the Node Palette on the left side
4. Scroll down past TRIGGERS, CONDITIONS, ACTIONS to the last category

**Environment:** localhost:3001, Chrome, 1280x720

---

## Actual Result

The heading reads "ADVANCEDS" (uppercase due to CSS `uppercase` class).

**Screenshot:** `docs/issues/screenshots/15-flow-editor.png`

---

## Expected Result

The heading should read "ADVANCED".

---

## Root Cause

In `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` line 61:

```tsx
<h4 className="...">{cat}s</h4>
```

The code naively appends "s" to each category name. For "trigger", "condition", "action" this works, but "advanced" becomes "advanceds".

---

## Acceptance Criteria
- [ ] The advanced category heading displays "ADVANCED" (not "ADVANCEDS")
- [ ] Other category headings remain correctly pluralized

---

## Notes

Fix options:
1. Use a lookup map: `{ trigger: "Triggers", condition: "Conditions", action: "Actions", advanced: "Advanced" }`
2. Special-case the "advanced" category to not append "s"

File: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` line 61
