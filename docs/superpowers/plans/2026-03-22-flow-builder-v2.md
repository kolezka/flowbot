# Flow Builder 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 1,646-line monolithic flow editor into composable components with command palette, data-driven property panels, variable autocomplete, auto-save drafts, inline validation, and a docked WebSocket execution debugger.

**Architecture:** Data-driven property panel replaces 50+ hand-coded form blocks. Each node type declares its fields via `NodeFieldSchema` in a static registry. Existing extracted components (NodePalette, VariableAutocomplete, ExecutionDebugger) are enhanced in-place. New components: CommandPalette, CanvasToolbar, VersionHistory. Auto-save uses a new `draftJson` column on FlowDefinition.

**Tech Stack:** Next.js 16, React 19, @xyflow/react 12.6, Radix UI, Tailwind 4, Socket.IO

**Spec:** `docs/superpowers/specs/2026-03-22-ui-ux-overhaul-design.md` — Section 2

**Existing extracted components (DO NOT recreate):**
- `components/flow-editor/NodePalette.tsx` (256 lines) — search, filters, categories
- `components/flow-editor/VariableAutocomplete.tsx` (223 lines) — `{{` trigger and dropdown
- `components/flow-editor/ExecutionDebugger.tsx` (218 lines) — overlay debugger
- `components/flow-editor/property-panels/ContextPanel.tsx` (164 lines)
- `components/flow-editor/property-panels/RunFlowPanel.tsx` (121 lines)
- `components/flow-editor/property-panels/registry.ts` (37 lines) — panel registry
- `packages/flow-shared/src/node-registry.ts` (207 lines) — NODE_TYPES with platform, category, color

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/flow-shared/src/node-field-schemas.ts` | Create | Field schemas for all 65+ node types |
| `apps/frontend/src/components/flow-editor/NodeConfigForm.tsx` | Create | Data-driven form renderer from schemas |
| `apps/frontend/src/components/flow-editor/PropertyPanel.tsx` | Create | Panel shell: header, validation badge, connection selector |
| `apps/frontend/src/components/flow-editor/CommandPalette.tsx` | Create | ⌘K modal with fuzzy search |
| `apps/frontend/src/components/flow-editor/CanvasToolbar.tsx` | Create | Top bar: name, version, save state, actions |
| `apps/frontend/src/components/flow-editor/VersionHistory.tsx` | Create | Version list with restore |
| `apps/frontend/src/components/flow-editor/FlowCanvas.tsx` | Create | ReactFlow wrapper extracted from page |
| `apps/frontend/src/lib/flow-editor/use-auto-save.ts` | Create | Auto-save hook with debounce |
| `apps/frontend/src/lib/flow-editor/use-command-palette.ts` | Create | ⌘K keyboard listener |
| `apps/frontend/src/lib/flow-editor/variable-registry.ts` | Create | Upstream variable resolution from graph |
| `apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx` | Modify | Upgrade to docked panel + WebSocket + variable inspector |
| `apps/frontend/src/components/flow-editor/VariableAutocomplete.tsx` | Modify | Integrate with variable-registry for upstream scoping |
| `apps/frontend/src/components/flow-editor/property-panels/registry.ts` | Modify | Register NodeConfigForm as default panel |
| `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` | Modify | Slim down to layout shell importing components |
| `packages/db/prisma/schema.prisma` | Modify | Add `draftJson` to FlowDefinition |
| `apps/frontend/src/lib/api.ts` | Modify | Add draft save/load methods |
| `apps/api/src/flows/flows.controller.ts` | Modify | Add draft endpoints |
| `apps/api/src/flows/flows.service.ts` | Modify | Add draft save/load logic |

---

### Task 1: Node Field Schema System

**Files:**
- Create: `packages/flow-shared/src/node-field-schemas.ts`

This is the foundation everything else builds on. Each node type declares its configurable fields as data.

- [ ] **Step 1: Define the NodeFieldSchema interface**

```typescript
export interface NodeFieldSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number" | "permissions";
  placeholder?: string;
  required?: boolean;
  supportsVariables?: boolean;
  options?: ReadonlyArray<{ label: string; value: string }>;
  validation?: { pattern?: string; min?: number; max?: number };
  defaultValue?: string | number | boolean;
}

export interface NodeOutputSchema {
  key: string;
  type: "string" | "number" | "boolean" | "object";
}

export interface NodeTypeSchema {
  type: string;
  fields: ReadonlyArray<NodeFieldSchema>;
  outputs: ReadonlyArray<NodeOutputSchema>;
}
```

- [ ] **Step 2: Define schemas for the most common nodes first**

Start with the 10 most-used action types. Reference existing form fields from `edit/page.tsx` lines 237-525 (ActionPropertyPanel) to extract field definitions:

```typescript
export const NODE_FIELD_SCHEMAS: ReadonlyArray<NodeTypeSchema> = [
  {
    type: "send_message",
    fields: [
      { key: "chatId", label: "Chat ID", type: "text", placeholder: "{{trigger.chatId}}", required: true, supportsVariables: true },
      { key: "text", label: "Message Text", type: "textarea", placeholder: "Enter message...", required: true, supportsVariables: true },
      { key: "parseMode", label: "Parse Mode", type: "select", options: [{ label: "None", value: "" }, { label: "HTML", value: "HTML" }, { label: "Markdown", value: "Markdown" }] },
      { key: "disableNotification", label: "Disable Notification", type: "checkbox" },
      { key: "replyToMessageId", label: "Reply To Message ID", type: "text", placeholder: "{{trigger.messageId}}", supportsVariables: true },
    ],
    outputs: [
      { key: "messageId", type: "string" },
    ],
  },
  // ... define send_photo, send_video, send_document, forward_message, ban_user, mute_user, etc.
];
```

- [ ] **Step 3: Define schemas for ALL 65 configurable node types**

Systematically go through `CONFIGURABLE_ACTIONS` set (edit/page.tsx lines 37-66) and create schemas for every type. Cross-reference the existing property panel code to get exact field names, types, and options.

Group by platform:
- Telegram actions (~25 types): send_message, send_photo, send_video, send_document, forward_message, ban_user, mute_user, restrict_user, pin_message, unpin_message, create_poll, answer_callback_query, etc.
- Telegram user actions (~18 types): user_send_message, user_send_photo, user_forward_message, user_join_group, user_leave_group, etc.
- Discord actions (~15 types): discord_send_message, discord_send_embed, discord_ban_member, discord_kick_member, discord_create_role, etc.
- Triggers and conditions: message_received, member_joined, callback_query, condition, discord_message_received, etc.

- [ ] **Step 4: Add helper function to look up schema by type**

```typescript
const SCHEMA_MAP = new Map(NODE_FIELD_SCHEMAS.map((s) => [s.type, s]));

export function getNodeSchema(type: string): NodeTypeSchema | undefined {
  return SCHEMA_MAP.get(type);
}

export function getNodeOutputs(type: string): ReadonlyArray<NodeOutputSchema> {
  return SCHEMA_MAP.get(type)?.outputs ?? [];
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/flow-shared/src/node-field-schemas.ts
git commit -m "feat(flow-shared): add node field schema system for all 65+ configurable node types"
```

---

### Task 2: Data-Driven NodeConfigForm

**Files:**
- Create: `apps/frontend/src/components/flow-editor/NodeConfigForm.tsx`
- Modify: `apps/frontend/src/components/flow-editor/property-panels/registry.ts`

- [ ] **Step 1: Create NodeConfigForm component**

Reads the schema for the selected node type and renders appropriate inputs. Replaces the 50+ hand-coded form blocks in ActionPropertyPanel, TriggerPropertyPanel, DiscordActionPropertyPanel, etc.

```tsx
"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariableAutocomplete } from "./VariableAutocomplete";
import { type NodeFieldSchema } from "@flowbot/flow-shared/node-field-schemas";

interface NodeConfigFormProps {
  fields: ReadonlyArray<NodeFieldSchema>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  availableVariables?: Array<{ name: string; type: string; source: string }>;
}

export function NodeConfigForm({ fields, values, onChange, availableVariables }: NodeConfigFormProps) {
  const renderField = useCallback(
    (field: NodeFieldSchema) => {
      const value = values[field.key] ?? field.defaultValue ?? "";
      const id = `field-${field.key}`;

      switch (field.type) {
        case "text":
          return field.supportsVariables ? (
            <VariableAutocomplete
              value={String(value)}
              onChange={(v) => onChange(field.key, v)}
              placeholder={field.placeholder}
              variables={availableVariables ?? []}
            />
          ) : (
            <Input
              id={id}
              value={String(value)}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          );

        case "textarea":
          return field.supportsVariables ? (
            <VariableAutocomplete
              value={String(value)}
              onChange={(v) => onChange(field.key, v)}
              placeholder={field.placeholder}
              variables={availableVariables ?? []}
              multiline
            />
          ) : (
            <Textarea
              id={id}
              value={String(value)}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
            />
          );

        case "select":
          return (
            <Select value={String(value)} onValueChange={(v) => onChange(field.key, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case "checkbox":
          return (
            <div className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(field.key, checked)}
              />
              <Label htmlFor={id} className="text-sm font-normal">
                {field.label}
              </Label>
            </div>
          );

        case "number":
          return (
            <Input
              id={id}
              type="number"
              value={String(value)}
              onChange={(e) => onChange(field.key, Number(e.target.value))}
              placeholder={field.placeholder}
              min={field.validation?.min}
              max={field.validation?.max}
            />
          );

        default:
          return null;
      }
    },
    [values, onChange, availableVariables],
  );

  return (
    <div className="flex flex-col gap-3.5">
      {fields.map((field) => (
        <div key={field.key}>
          {field.type !== "checkbox" && (
            <Label htmlFor={`field-${field.key}`} className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
              {field.label}
              {field.required && <span className="text-red-400"> *</span>}
            </Label>
          )}
          {renderField(field)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add on-blur validation to NodeConfigForm**

Each field validates on blur. Track validation errors in component state:

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

function validateField(field: NodeFieldSchema, value: unknown): string | null {
  if (field.required && (!value || String(value).trim() === "")) {
    return `${field.label} is required`;
  }
  if (field.validation?.pattern && typeof value === "string") {
    if (!new RegExp(field.validation.pattern).test(value)) {
      return `${field.label} format is invalid`;
    }
  }
  if (field.validation?.min !== undefined && Number(value) < field.validation.min) {
    return `${field.label} must be at least ${field.validation.min}`;
  }
  if (field.validation?.max !== undefined && Number(value) > field.validation.max) {
    return `${field.label} must be at most ${field.validation.max}`;
  }
  return null;
}
```

On blur, validate and show red border + error text below the field. Export an `isValid` boolean (no errors for any required field) for the PropertyPanel validation badge.

- [ ] **Step 3: Register NodeConfigForm as default panel in registry.ts**

Modify `components/flow-editor/property-panels/registry.ts` to use NodeConfigForm as the fallback panel when no custom panel is registered for a node type. ContextPanel and RunFlowPanel remain as custom overrides.

- [ ] **Step 3: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/NodeConfigForm.tsx apps/frontend/src/components/flow-editor/property-panels/registry.ts
git commit -m "feat(frontend): add data-driven NodeConfigForm replacing hand-coded property panels"
```

---

### Task 3: PropertyPanel Shell

**Files:**
- Create: `apps/frontend/src/components/flow-editor/PropertyPanel.tsx`

- [ ] **Step 1: Create PropertyPanel component**

Shell that wraps NodeConfigForm (or custom panel from registry). Shows:
- Header: node type label, category badge, close button
- Validation status badge (green ✓ or red ⚠)
- Form content (from schema or custom panel)
- Footer: connection selector dropdown

```tsx
interface PropertyPanelProps {
  node: { id: string; type: string; data: Record<string, unknown> } | null;
  onClose: () => void;
  onChange: (nodeId: string, key: string, value: unknown) => void;
  connections: Array<{ id: string; name: string; status: string }>;
  selectedConnectionId?: string;
  onConnectionChange: (connectionId: string) => void;
  availableVariables: Array<{ name: string; type: string; source: string }>;
}
```

Looks up the panel from registry first; falls back to NodeConfigForm with schema lookup.

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/PropertyPanel.tsx
git commit -m "feat(frontend): add PropertyPanel shell with validation badge and connection selector"
```

---

### Task 4: Variable Registry (Upstream Scoping)

**Files:**
- Create: `apps/frontend/src/lib/flow-editor/variable-registry.ts`
- Modify: `apps/frontend/src/components/flow-editor/VariableAutocomplete.tsx`

- [ ] **Step 1: Create variable-registry module**

Walks the node graph upstream from a selected node to compute available variables:

```typescript
import { type Node, type Edge } from "@xyflow/react";
import { getNodeOutputs } from "@flowbot/flow-shared/node-field-schemas";

export interface AvailableVariable {
  name: string;
  type: string;
  source: string; // node label or "trigger"
}

export function getAvailableVariables(
  selectedNodeId: string,
  nodes: ReadonlyArray<Node>,
  edges: ReadonlyArray<Edge>,
): ReadonlyArray<AvailableVariable> {
  const variables: AvailableVariable[] = [];
  const visited = new Set<string>();

  // Walk upstream via edges
  function walkUpstream(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const outputs = getNodeOutputs(String(node.type ?? node.data?.type ?? ""));
    const source = String(node.data?.label ?? node.type ?? "unknown");

    for (const output of outputs) {
      variables.push({
        name: `${source}.${output.key}`,
        type: output.type,
        source,
      });
    }

    // Find edges pointing to this node
    for (const edge of edges) {
      if (edge.target === nodeId) {
        walkUpstream(edge.source);
      }
    }
  }

  // Start from edges pointing to the selected node
  for (const edge of edges) {
    if (edge.target === selectedNodeId) {
      walkUpstream(edge.source);
    }
  }

  // Always include trigger variables
  const triggerNode = nodes.find(
    (n) => String(n.data?.type ?? n.type ?? "").includes("trigger") || String(n.data?.type ?? n.type ?? "").includes("received"),
  );
  if (triggerNode && !visited.has(triggerNode.id)) {
    const outputs = getNodeOutputs(String(triggerNode.type ?? triggerNode.data?.type ?? ""));
    for (const output of outputs) {
      variables.push({ name: `trigger.${output.key}`, type: output.type, source: "trigger" });
    }
  }

  return variables;
}
```

- [ ] **Step 2: Update VariableAutocomplete to accept variables from registry**

Modify the existing `VariableAutocomplete.tsx` (223 lines) to accept an `variables` prop and display them grouped by source with type hints.

- [ ] **Step 3: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/lib/flow-editor/variable-registry.ts apps/frontend/src/components/flow-editor/VariableAutocomplete.tsx
git commit -m "feat(frontend): add variable registry with upstream graph scoping"
```

---

### Task 5: Auto-Save Drafts

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add draftJson to FlowDefinition)
- Create: `apps/frontend/src/lib/flow-editor/use-auto-save.ts`
- Modify: `apps/frontend/src/lib/api.ts` (add draft methods)
- Modify: `apps/api/src/flows/flows.controller.ts` (add draft endpoints)
- Modify: `apps/api/src/flows/flows.service.ts` (add draft logic)

- [ ] **Step 1: Add draftJson column to FlowDefinition**

In `packages/db/prisma/schema.prisma` at the FlowDefinition model (line ~578), add:

```prisma
draftJson Json? // Auto-saved draft state (nodes + edges), separate from published
```

- [ ] **Step 2: Run migration**

```bash
pnpm db prisma:migrate -- --name add-flow-draft-json
pnpm db generate
pnpm db build
```

- [ ] **Step 3: Add API endpoints for draft save/load**

In `flows.controller.ts`:
- `PUT /flows/:id/draft` — saves `{ nodesJson, edgesJson }` to `draftJson`
- `GET /flows/:id/draft` — returns `draftJson` or null

In `flows.service.ts`:
- `saveDraft(flowId, data)` — updates `draftJson` field
- `getDraft(flowId)` — returns `draftJson`

- [ ] **Step 4: Add frontend API methods**

In `apps/frontend/src/lib/api.ts`:

```typescript
async saveFlowDraft(flowId: string, data: { nodesJson: unknown; edgesJson: unknown }): Promise<void> {
  return this.request(`/flows/${flowId}/draft`, { method: "PUT", body: JSON.stringify(data) });
}

async getFlowDraft(flowId: string): Promise<{ nodesJson: unknown; edgesJson: unknown } | null> {
  return this.request(`/flows/${flowId}/draft`);
}
```

- [ ] **Step 5: Create use-auto-save hook**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

type SaveState = "saved" | "unsaved" | "saving" | "error";

interface UseAutoSaveOptions {
  flowId: string;
  nodesJson: unknown;
  edgesJson: unknown;
  onSave: (data: { nodesJson: unknown; edgesJson: unknown }) => Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({ flowId, nodesJson, edgesJson, onSave, debounceMs = 10000 }: UseAutoSaveOptions) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastJsonRef = useRef<string>("");

  const currentJson = JSON.stringify({ nodesJson, edgesJson });

  useEffect(() => {
    if (currentJson !== lastJsonRef.current) {
      setSaveState("unsaved");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await onSave({ nodesJson, edgesJson });
          lastJsonRef.current = currentJson;
          setSaveState("saved");
          setLastSaved(new Date());
        } catch {
          setSaveState("error");
        }
      }, debounceMs);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentJson, debounceMs, nodesJson, edgesJson, onSave]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      await onSave({ nodesJson, edgesJson });
      lastJsonRef.current = JSON.stringify({ nodesJson, edgesJson });
      setSaveState("saved");
      setLastSaved(new Date());
    } catch {
      setSaveState("error");
    }
  }, [nodesJson, edgesJson, onSave]);

  return { saveState, lastSaved, saveNow };
}
```

- [ ] **Step 6: Add "Restore draft?" prompt logic**

In the page shell (Task 11), on page load after fetching the flow, check if `draftJson` exists and differs from `nodesJson`:

```typescript
const draft = await api.getFlowDraft(flowId);
if (draft && JSON.stringify(draft.nodesJson) !== JSON.stringify(flow.nodesJson)) {
  setShowDraftPrompt(true); // Show dialog: "You have unsaved changes from a previous session. Restore draft?"
  setPendingDraft(draft);
}
```

If user clicks "Restore", load `draft.nodesJson`/`draft.edgesJson` into the editor state. If "Discard", clear the draft via `DELETE /flows/:id/draft` or overwrite with current.

- [ ] **Step 7: Run tests**

```bash
pnpm api test -- --testPathPattern=flows
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/ apps/api/src/flows/ apps/frontend/src/lib/flow-editor/use-auto-save.ts apps/frontend/src/lib/api.ts
git commit -m "feat: add auto-save drafts with draftJson column, debounced save hook, and draft restore prompt"
```

---

### Task 6: CanvasToolbar Component

**Files:**
- Create: `apps/frontend/src/components/flow-editor/CanvasToolbar.tsx`

- [ ] **Step 1: Create CanvasToolbar component**

Top bar with:
- Back arrow + editable flow name
- Version badge ("v3") + save state indicator (Unsaved/Saving/Saved/Published)
- ⌘K command palette trigger button
- Validate button, History button
- Save Draft button, Test Run button (green)

```tsx
interface CanvasToolbarProps {
  flowName: string;
  onNameChange: (name: string) => void;
  version: number;
  saveState: "saved" | "unsaved" | "saving" | "error";
  lastSaved: Date | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  onTestRun: () => void;
  onValidate: () => void;
  onOpenHistory: () => void;
  onOpenCommandPalette: () => void;
  onBack: () => void;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/CanvasToolbar.tsx
git commit -m "feat(frontend): add CanvasToolbar with save state indicator and action buttons"
```

---

### Task 7: Command Palette

**Files:**
- Create: `apps/frontend/src/components/flow-editor/CommandPalette.tsx`
- Create: `apps/frontend/src/lib/flow-editor/use-command-palette.ts`

- [ ] **Step 1: Create useCommandPalette hook**

Listens for ⌘K (Mac) / Ctrl+K (Windows) and toggles open state:

```typescript
import { useCallback, useEffect, useState } from "react";

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, close };
}
```

- [ ] **Step 2: Create CommandPalette component**

Centered modal with fuzzy search. Searches across:
- Node types from `NODE_TYPES` (node-registry.ts) — grouped under "Nodes"
- Editor actions (Test Run, Validate, Save, Publish, Undo, Redo) — grouped under "Actions"

Searches across three categories:
- **Nodes** — from `NODE_TYPES` (node-registry.ts): name, platform, category, description
- **Actions** — editor commands: Test Run, Validate, Save, Publish, Undo, Redo
- **Settings** — zoom level, grid toggle, minimap toggle

Uses simple substring matching (upgrade to fuse.js later if needed). Results show match highlighting, platform, category, description.

Selecting a node type calls `onAddNode(type)`. Selecting an action or setting calls the corresponding callback.

```tsx
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddNode: (type: string) => void;
  onAction: (action: string) => void;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/components/flow-editor/CommandPalette.tsx apps/frontend/src/lib/flow-editor/use-command-palette.ts
git commit -m "feat(frontend): add command palette with fuzzy search for nodes and actions"
```

---

### Task 8: Upgrade ExecutionDebugger to Docked Panel + WebSocket

**Files:**
- Modify: `apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx` (218 lines)
- Modify: `apps/api/src/events/events.gateway.ts` or equivalent WebSocket gateway

- [ ] **Step 1: Upgrade ExecutionDebugger layout**

Change from overlay to docked bottom panel:
- Resizable via drag handle at top edge
- Two-column layout: step timeline (left) + variable inspector (right)
- Toolbar with status dot, elapsed timer, Steps/Variables/Output tabs, close button

- [ ] **Step 2: Replace polling with WebSocket**

Remove the `setInterval` polling (currently 1000ms). Subscribe to Socket.IO event `flow:execution:update`:

```tsx
import { useSocketEvent } from "@/lib/websocket";

// Inside component:
useSocketEvent<ExecutionUpdate>("flow:execution:update", (data) => {
  if (data.executionId === executionId) {
    updateStep(data.nodeId, data.status, data.variables, data.duration);
  }
});
```

- [ ] **Step 3: Add variable inspector column**

Shows all variables at the selected step, formatted as:
- Variable name (colored by source: trigger=purple, condition=amber, action=blue)
- Value (colored by type: string=default, boolean=green/red, number=blue)

- [ ] **Step 4: Add `flow:execution:update` event to API WebSocket gateway**

In the API's Socket.IO gateway, add a method to emit execution updates. This will be called from the flow execution service when Trigger.dev reports step completion.

- [ ] **Step 5: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/components/flow-editor/ExecutionDebugger.tsx apps/api/src/events/
git commit -m "feat: upgrade ExecutionDebugger to docked panel with WebSocket and variable inspector"
```

---

### Task 9: VersionHistory Panel

**Files:**
- Create: `apps/frontend/src/components/flow-editor/VersionHistory.tsx`

- [ ] **Step 1: Create VersionHistory component**

Right-side sheet (replaces property panel when open). Shows:
- Version list from `getFlowVersions()` API (line 1512 in api.ts)
- Each version: number, description, timestamp, "restore" link
- Current version highlighted
- Restore prompts confirmation, then calls `restoreFlowVersion()` (line 1527) and reloads editor

```tsx
interface VersionHistoryProps {
  flowId: string;
  currentVersion: number;
  open: boolean;
  onClose: () => void;
  onRestore: (version: number) => void;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/VersionHistory.tsx
git commit -m "feat(frontend): add VersionHistory panel with version list and restore"
```

---

### Task 10: FlowCanvas Extraction

**Files:**
- Create: `apps/frontend/src/components/flow-editor/FlowCanvas.tsx`

- [ ] **Step 1: Extract ReactFlow canvas from page.tsx**

Move the ReactFlow component, node/edge state, and canvas-specific handlers (onConnect, onDrop, onNodeDragStop, etc.) from `edit/page.tsx` into a dedicated `FlowCanvas.tsx`.

FlowCanvas receives:
- nodes, edges, onNodesChange, onEdgesChange
- onNodeSelect (when a node is clicked)
- onDrop (when a palette item is dropped)
- Custom node types (SubflowNode, StickyNote)

It renders: ReactFlow, Controls, MiniMap, Background, zoom controls.

- [ ] **Step 2: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/components/flow-editor/FlowCanvas.tsx
git commit -m "refactor(frontend): extract FlowCanvas component from monolithic editor"
```

---

### Task 11: Rewrite page.tsx as Layout Shell

**Files:**
- Modify: `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` (1,646 lines → ~200 lines)

This is the critical integration task. The page becomes a thin orchestration layer.

- [ ] **Step 1: Rewrite page.tsx**

The page now:
1. Fetches flow data on mount
2. Manages top-level state: nodes, edges, selectedNode, showHistory, showDebugger
3. Computes availableVariables via `getAvailableVariables()` when selectedNode changes
4. Renders the three-pane layout:

```tsx
<div className="flex h-screen flex-col">
  <CanvasToolbar ... />
  <div className="flex flex-1 min-h-0">
    <NodePalette ... />
    <FlowCanvas ... />
    {showHistory ? (
      <VersionHistory ... />
    ) : selectedNode ? (
      <PropertyPanel ... />
    ) : null}
  </div>
  {showDebugger && <ExecutionDebugger ... />}
  <CommandPalette ... />
</div>
```

- [ ] **Step 2: Remove all inline component definitions**

Delete the following from page.tsx (they're now separate files or replaced by NodeConfigForm):
- `NodePalette` inline definition (line 78) — already extracted to `components/flow-editor/NodePalette.tsx`
- Field input components (lines 140-237) — replaced by NodeConfigForm
- `ActionPropertyPanel` (line 237) — replaced by NodeConfigForm via schema
- `TriggerPropertyPanel` (line 525) — replaced by NodeConfigForm via schema
- `ConditionPropertyPanel` (line 640) — replaced by NodeConfigForm via schema
- `DiscordActionPropertyPanel` (line 782) — replaced by NodeConfigForm via schema
- `DiscordTriggerPropertyPanel` (line 999) — replaced by NodeConfigForm via schema
- `DiscordConditionPropertyPanel` (line 1040) — replaced by NodeConfigForm via schema
- `ConnectionOverridePanel` (line 1103) — moved into PropertyPanel footer
- `CONFIGURABLE_ACTIONS` set (lines 37-66) — replaced by schema lookup

- [ ] **Step 3: Add beforeunload handler for unsaved changes**

```tsx
useEffect(() => {
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (saveState === "unsaved") {
      e.preventDefault();
    }
  }
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [saveState]);
```

- [ ] **Step 4: Verify the editor still works end-to-end**

Run: `pnpm frontend build 2>&1 | tail -10`

Then manual test: `pnpm frontend dev`
- Open a flow in the editor
- Verify nodes render on canvas
- Verify property panel shows when clicking a node
- Verify node palette search works
- Verify save/load works

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx
git commit -m "refactor(frontend): slim flow editor page from 1646 to ~200 lines"
```

---

### Task 12: Node Templates

**Files:**
- Create: `apps/frontend/public/flow-templates/welcome.json`
- Create: `apps/frontend/public/flow-templates/moderation.json`
- Modify: `apps/frontend/src/components/flow-editor/NodePalette.tsx`

- [ ] **Step 1: Create template JSON files**

Each template contains pre-connected nodes + edges:

```json
{
  "name": "Welcome Flow",
  "description": "Send a welcome message when a member joins",
  "nodes": [
    { "type": "member_joined", "data": { "label": "Member Joined" }, "position": { "x": 0, "y": 0 } },
    { "type": "send_message", "data": { "label": "Send Welcome", "text": "Welcome {{trigger.userName}}!" }, "position": { "x": 250, "y": 0 } }
  ],
  "edges": [
    { "source": "0", "target": "1" }
  ]
}
```

- [ ] **Step 2: Add templates section to NodePalette**

At the bottom of the existing `NodePalette.tsx` (256 lines), add a "Templates" section that lists available templates. Clicking a template drops its nodes + edges onto the canvas with position offsets.

- [ ] **Step 3: Verify build**

Run: `pnpm frontend build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/public/flow-templates/ apps/frontend/src/components/flow-editor/NodePalette.tsx
git commit -m "feat(frontend): add flow templates (Welcome, Moderation) to node palette"
```

---

### Task 13: Final Integration Test

- [ ] **Step 1: Run full build**

```bash
pnpm frontend build
```

- [ ] **Step 2: Run all tests**

```bash
pnpm api test
pnpm telegram-bot-connector test
pnpm telegram-user-connector test
pnpm discord-bot-connector test
pnpm whatsapp-user-connector test
pnpm platform-kit test
pnpm trigger test
```

- [ ] **Step 3: Manual verification checklist**

Run `pnpm frontend dev` and verify:
- [ ] Flow editor loads without errors
- [ ] Node palette shows filtered nodes with search
- [ ] ⌘K opens command palette with fuzzy search
- [ ] Clicking a node opens property panel with schema-driven form
- [ ] Typing `{{` in a field shows variable autocomplete with upstream variables
- [ ] Save state indicator shows Unsaved → Saving → Saved transitions
- [ ] Test Run opens docked debugger with step timeline
- [ ] History button opens version list with restore
- [ ] Templates section in palette drops pre-connected nodes
- [ ] All existing flow functionality preserved (create, edit, delete, activate)

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat(frontend): complete Flow Builder 2.0 integration"
```
