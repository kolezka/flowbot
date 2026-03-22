# UI/UX Overhaul: Connection Hub + Flow Builder 2.0

**Date:** 2026-03-22
**Status:** Draft
**Scope:** Two frontend features — Connection Hub (full redesign) and Flow Builder 2.0 (complete rebuild)
**Design Direction:** Clean & minimal (Vercel/Linear aesthetic)

---

## 1. Connection Hub

### Problem

The current connections UI has three key pain points:

1. **No error recovery** — auth failures require restarting the entire wizard from scratch
2. **No health verification** — after connecting, there's no confirmation the connection actually works
3. **Tedious scope management** — group/user IDs must be looked up externally and typed one by one

### Solution: Connection Hub with Inline Auth

Replace the multi-page wizard and flat list with a status-first hub page and sheet-based auth flow.

### 1.1 Hub Overview Page

Replaces `/dashboard/connections/page.tsx`.

**Layout:**
- Top: title bar with connection count summary ("4 active · 1 error · 6 total") and "+ New Connection" button
- Health strip: three cells showing Active (green), Error (red), Inactive (neutral) counts
- Filter bar: segmented platform filter (All | Telegram | Discord | WhatsApp) + search input
- Connection list: rows with status dot, platform icon, name, type, last active time, health badge

**Connection row states:**
- **Healthy:** green dot, "Healthy" badge, overflow menu (⋯)
- **Error:** red dot, red border highlight, "Auth Error" badge, inline "Re-auth" button, overflow menu
- **Inactive:** neutral dot, "Inactive" badge, overflow menu

**Overflow menu actions:** Edit name, Configure scope, View logs, Restart, Delete

### 1.2 Auth Sheet (Slide-in Panel)

Replaces `/dashboard/connections/auth/page.tsx` and all sub-components.

**Trigger:** "+ New Connection" button opens a right-side sheet (Radix Sheet component).

**Step flow:**
1. **Platform selection** — three platform cards (Telegram, Discord, WhatsApp) with descriptions
2. **Type selection** — Telegram only: Bot Token vs Account (MTProto)
3. **Name + credentials** — connection name + platform-specific auth input
4. **Verification** — code input (Telegram MTProto), QR scan (WhatsApp), or immediate (bot tokens)
5. **Health check** — auto-runs after auth completes
6. **Scope configuration** — searchable group/user picker

**Navigation:** breadcrumb trail at top of sheet showing all steps. Back button returns to previous step without losing data.

**Key behavior:**
- All steps happen within the sheet — no page navigation
- Each step's state is preserved when going back
- Sheet can be dismissed (with confirmation if mid-auth)

### 1.3 Inline Error Recovery

**During auth (wrong code, timeout):**
- Error message appears inline below the input field
- "Resend code" link available for verification steps
- Attempt counter shown ("2 attempts remaining")
- User can retry without restarting the flow

**After auth (session expired, connection lost):**
- Connection card shows "Re-auth" button
- Clicking opens auth sheet pre-filled with existing connection data (name, phone number)
- Auth restarts at the credentials step, not platform selection
- Connection settings and scope are preserved

### 1.4 Post-Auth Health Check

Runs automatically after successful authentication.

**Checks (platform-dependent):**
- Authentication valid
- API connection stable (shows latency in ms)
- Bot permissions OK (Telegram bot: getMe check; Discord: guild list)
- Group/channel list fetchable

**UI:** checklist with green checkmarks appearing sequentially. Spinner on current check. Error state with retry button if a check fails.

### 1.5 Visual Scope Manager

Replaces the current ID-by-ID scope editor.

**How it works:**
1. After health check, the sheet fetches the list of groups/channels the connection has access to
2. Displays a searchable, checkbox-selectable list
3. Each item shows: group name, group ID, member count, group icon/emoji
4. Selected items get a green highlight
5. Footer shows selection count + "Save & Finish" button

**New API endpoint required:** `GET /api/connections/:id/available-groups` — returns groups the connection can see, with names and member counts. The API routes this through the connector pool's `POST /execute` endpoint using a new `list_groups` action registered in all four connector packages. Each connector implements this action using its platform SDK (grammY getMyChats for telegram-bot, GramJS getDialogs for telegram-user, Discord.js guild list for discord-bot, Baileys groupFetchAllParticipating for whatsapp-user).

**Fallback:** if the API can't fetch groups (permissions issue), show a text input for manual ID entry (current behavior) with a message explaining why the picker isn't available.

### 1.6 Files to Create/Modify

**New components:**
- `components/connections/ConnectionHub.tsx` — hub page layout, health strip, filter bar
- `components/connections/ConnectionCard.tsx` — individual connection row
- `components/connections/AuthSheet.tsx` — sheet container with step management
- `components/connections/auth-steps/PlatformSelect.tsx` — includes Telegram type sub-selection (Bot vs Account)
- `components/connections/auth-steps/NameAndCredentials.tsx`
- `components/connections/auth-steps/Verification.tsx`
- `components/connections/auth-steps/HealthCheck.tsx`
- `components/connections/ScopeManager.tsx` — searchable group picker
- `components/connections/ReauthSheet.tsx` — pre-filled re-auth variant

**Modified pages:**
- `app/dashboard/connections/page.tsx` — replace with ConnectionHub
- `app/dashboard/connections/[id]/page.tsx` — update scope editor to use ScopeManager

**Removed pages:**
- `app/dashboard/connections/auth/page.tsx` — replaced by AuthSheet
- Auth sub-components (TelegramMTProtoAuth, TelegramBotAuth, DiscordAuth, WhatsAppAuthWizard) — logic absorbed into auth-steps

**New API endpoint:**
- `GET /api/connections/:id/available-groups` in apps/api

---

## 2. Flow Builder 2.0

### Problem

The current flow editor has five key pain points:

1. **Monolithic codebase** — ~1400-line single file, hard to maintain and extend
2. **No variable autocomplete** — users must memorize `{{trigger.chatId}}` syntax
3. **No unsaved-changes indicator** — edits can be silently lost
4. **No field-level validation** — errors only surface at execution time
5. **Polling-based debugger** — clunky overlay with 1s polling, no variable inspection

### Solution: Component-Based Editor with IDE Features

Decompose the monolith into focused components. Add command palette, variable autocomplete, auto-save, inline validation, and a docked WebSocket debugger.

### 2.1 Editor Layout

Three-pane layout with collapsible side panels:

- **Left (240px):** Node Palette — search, platform filter tabs, recent nodes, categorized node list, templates section
- **Center (flex):** ReactFlow canvas with dot grid, zoom controls, minimap
- **Right (280px):** Property Panel — node configuration form with validation

**Top toolbar (left to right):**
- Back arrow + flow name (editable inline)
- Version badge ("v3") + save state indicator
- Command palette trigger ("Search actions... ⌘K")
- Validate button, History button
- Save Draft button, Test Run button (green accent)

### 2.2 Command Palette (⌘K)

Global keyboard shortcut opens a centered modal with:

**Search input** at top — fuzzy matches against:
- Node types (grouped under "Nodes" header): name, platform, description
- Editor actions (grouped under "Actions" header): Test Run, Validate, Save, Publish, Undo, Redo
- Settings: zoom level, grid toggle, minimap toggle

**Result items show:**
- Color-coded type indicator (bar on left)
- Name with match highlighting (bold matched characters)
- Platform + category + description
- Keyboard shortcut (for actions) or "drag" hint (for nodes)

**Keyboard navigation:** ↑↓ to move, Enter to select (adds node at cursor or executes action), Esc to close.

**Selecting a node:** adds it to the canvas at the center of the current viewport (or near the last selected node if one exists).

### 2.3 Variable Autocomplete

**Trigger:** typing `{{` in any text/textarea input field in the property panel.

**Dropdown shows:**
- Available variables from upstream nodes, scoped to what's reachable from the current node
- Each variable shows: name (monospace), type hint (string, boolean, number)
- Variables grouped by source node (trigger.*, condition.*, context.*)

**Variable resolution:**
- `trigger.*` — fields from the trigger node type (chatId, userId, messageText, senderName, isAdmin, messageId, etc.)
- `context.*` — keys from upstream set_context/get_context nodes
- `{nodeLabel}.*` — output fields from upstream action nodes (e.g., sendMessage.messageId)

**Implementation:** a shared `VariableAutocomplete` component wraps text inputs. It maintains a registry of available variables by walking the node graph upstream from the selected node. The registry is rebuilt when edges change.

**New data needed:** each node type declares its output schema (what variables it produces). This is a static map in the frontend — no API needed.

### 2.4 Property Panel Refactor

The current 50+ inline node type configurations become a data-driven form system.

**Node config schema:** each node type defines a JSON schema of its fields:

```typescript
interface NodeFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'permissions';
  placeholder?: string;
  required?: boolean;
  supportsVariables?: boolean; // enables {{ autocomplete
  options?: { label: string; value: string }[]; // for select
  validation?: { pattern?: string; min?: number; max?: number };
}
```

**Field rendering:** a single `NodeConfigForm` component reads the schema and renders the appropriate input for each field. No more 50x repeated TextInput/SelectInput blocks.

**Validation:** each field validates on blur. Invalid fields show a red border + error message below. The node itself shows a validation badge (green check or red warning) in the property panel header.

### 2.5 Auto-Save Drafts

**Save states (shown in toolbar):**
1. **Unsaved** (amber dot) — changes exist that haven't been saved
2. **Saving...** (blue spinner) — auto-save in progress
3. **Saved** (green check) — draft saved, with "Xs ago" timestamp
4. **Published** (green check) — explicit version created

**Behavior:**
- Auto-save triggers 10 seconds after the last change (debounced)
- Auto-save writes to a `draft` field on the flow record (new DB column: `FlowDefinition.draftJson`)
- "Save Draft" button triggers immediate save
- "Publish" button (replaces current "Save") saves AND creates a new FlowVersion
- On page load, if `draftJson` differs from `nodesJson`, show a "Restore draft?" prompt

**Unsaved changes guard:** beforeunload handler + in-app navigation intercept warns if there are unsaved changes.

### 2.6 Docked Execution Debugger

Replaces the current overlay with a resizable bottom panel.

**Layout:**
- Resize handle at top edge (drag to resize)
- Toolbar: "Execution" title, status dot (green pulse when running), elapsed time, tab selector (Steps | Variables | Output), close button
- Content area split: step timeline (left) + variable inspector (right)

**Step timeline:**
- Each step shows: status icon (✓ green, spinner blue, ○ pending, ✗ red), node name, description of what happened, execution time
- Clicking a step highlights the corresponding node on the canvas and updates the variable inspector

**Variable inspector:**
- Shows all variables at the selected step
- Format: `variable.name` (colored by source) → `"value"` (colored by type)
- Updates in real-time via WebSocket

**WebSocket integration:** uses the existing Socket.IO connection (`lib/websocket.tsx`) with a new event: `flow:execution:update`. The API emits step-level updates as the Trigger.dev task progresses.

**New API/event needed:**
- Socket.IO event `flow:execution:update` with payload: `{ executionId, nodeId, status, variables, output, duration }`
- Trigger.dev task emits these via the API's EventBus

### 2.7 Version History Panel

Accessed via "History" button in toolbar. Opens as a right-side sheet (replaces property panel temporarily).

**Version list:**
- Each version shows: version number, description (from commit message), timestamp, "diff" and "restore" links
- Current version highlighted with blue border
- Clicking "restore" prompts confirmation, then loads that version's nodes/edges into the editor as a draft
- Visual diff (side-by-side node comparison) is deferred — version list shows metadata only for v1

### 2.8 Node Templates

Bottom section of the node palette.

**Templates are pre-built flow snippets** — groups of connected nodes that can be dropped onto the canvas as a unit.

**Built-in templates:**
- Welcome Flow: Message Received trigger → Send Welcome Message
- Moderation Flow: Message Received → Content Check condition → Delete Message / Warn User
- Broadcast Flow: Manual trigger → Send Message to multiple chats

**Implementation:** templates are JSON files (nodes + edges) stored in `public/flow-templates/`. Dropping a template adds all its nodes/edges to the canvas with offset positions relative to the drop point.

### 2.9 Component Decomposition

The ~1400-line `apps/frontend/src/app/dashboard/flows/[id]/edit/page.tsx` splits into:

| Component | Responsibility | Est. Lines |
|-----------|---------------|------------|
| `page.tsx` | Layout shell, state orchestration | ~200 |
| `components/flow-editor/NodePalette.tsx` | Search, filters, categories, drag handlers | ~250 |
| `components/flow-editor/CommandPalette.tsx` | ⌘K modal, fuzzy search, keyboard nav | ~200 |
| `components/flow-editor/PropertyPanel.tsx` | Node config form shell, validation display | ~150 |
| `components/flow-editor/NodeConfigForm.tsx` | Data-driven field rendering from schema | ~300 |
| `components/flow-editor/VariableAutocomplete.tsx` | `{{` trigger, dropdown, variable resolution | ~200 |
| `components/flow-editor/ExecutionDebugger.tsx` | Bottom panel, step timeline, variable inspector | ~300 |
| `components/flow-editor/VersionHistory.tsx` | Version list, restore | ~200 |
| `components/flow-editor/CanvasToolbar.tsx` | Top toolbar, save state, actions | ~150 |
| `components/flow-editor/FlowCanvas.tsx` | ReactFlow wrapper, node/edge rendering | ~200 |
| `lib/flow-editor/node-schemas.ts` | Node type field schemas (static data) | ~400 |
| `lib/flow-editor/variable-registry.ts` | Upstream variable resolution from graph | ~150 |
| `lib/flow-editor/use-auto-save.ts` | Auto-save hook with debounce | ~80 |
| `lib/flow-editor/use-command-palette.ts` | ⌘K listener, search logic | ~100 |

**Total:** ~2,980 lines across 14 files (avg ~213 lines/file) vs current ~1,400 in one file. More code overall but dramatically more maintainable.

---

## 3. New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/connections/:id/available-groups` | GET | Fetch groups/channels the connection can see with names and member counts |
| `/api/flows/:id/draft` | PUT | Save draft JSON |
| `/api/flows/:id/draft` | GET | Load draft JSON |

**WebSocket event:**
| Event | Direction | Purpose |
|-------|-----------|---------|
| `flow:execution:update` | server → client | Real-time execution step updates |

---

## 4. Database Changes

| Table | Change | Purpose |
|-------|--------|---------|
| `FlowDefinition` | Add `draftJson Json?` column | Store auto-save drafts separately from published flow |

---

## 5. Scope Boundaries (What's NOT Included)

To prevent scope creep, the following are explicitly deferred:

- **Multi-tab editing** — single flow open at a time (can add later with tab state management)
- **Collaborative editing** — no real-time multi-user cursors (can layer on with CRDT later)
- **Flow marketplace** — no sharing/importing flows from other users
- **Custom node types** — users can't define their own node types (templates cover common patterns)
- **Connection avatars/profile photos** — scope manager shows names and IDs, not profile pictures
- **Flow diff visualization** — visual side-by-side node comparison deferred; version history shows metadata and restore only
- **Deep undo/redo** — ReactFlow's built-in canvas undo (node move/delete) is exposed via the command palette, but undo across property panel edits is deferred

---

## 6. Implementation Order

1. **Connection Hub** (smaller scope, independent of Flow Builder)
   - Phase 1: Hub page + connection cards + filter/search
   - Phase 2: Auth sheet with step flow + inline retry
   - Phase 3: Health check + scope manager + available-groups API

2. **Flow Builder 2.0** (larger scope, depends on existing flow infrastructure)
   - Phase 1: Component decomposition (split monolith, no new features)
   - Phase 2: Node schema system + data-driven property panel
   - Phase 3: Variable autocomplete + inline validation
   - Phase 4: Auto-save drafts + unsaved changes indicator
   - Phase 5: Command palette (⌘K)
   - Phase 6: Docked execution debugger with WebSocket
   - Phase 7: Version history panel + node templates

---

## 7. Success Criteria

- Auth errors recoverable without restarting the wizard
- Health check runs automatically after every new connection
- Scope management uses searchable picker, not manual ID entry
- Flow editor loads and saves correctly after component decomposition
- `{{` triggers variable autocomplete with upstream-scoped variables
- Unsaved changes indicator visible at all times
- Execution debugger updates in real-time (no polling)
- All existing flow functionality preserved (no regressions)
