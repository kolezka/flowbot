# Flow Builder

## Overview

The flow builder is a visual automation engine that lets you design workflows as directed graphs of interconnected nodes. Each flow starts with a **trigger** (an event that initiates the flow), passes through optional **conditions** (gates that control branching), and executes **actions** (side effects like sending messages or banning users).

Flows are stored as JSON definitions (`nodesJson` and `edgesJson`) in the database. When a trigger fires, the flow execution engine performs a breadth-first traversal of the graph, evaluating each node in order and passing data between them via a shared context.

Key concepts:

- **Nodes** represent individual steps (triggers, conditions, actions, control flow).
- **Edges** connect nodes, defining execution order.
- **Variables** carry data between nodes using `{{template.interpolation}}` syntax.
- **Error handling** is configurable per node (stop, skip, or retry).

Flows must be validated and activated before they run in production. Validation checks for at least one trigger node, no cycles, and valid edge references.

---

## Node Reference

### Triggers

Trigger nodes are entry points that start a flow. Every flow must have at least one trigger.

| Type | Description | Config |
|------|-------------|--------|
| `message_received` | Fires when a message is received in a chat | None required |
| `user_joins` | Fires when a new user joins a group | None required |
| `schedule` | Fires on a cron schedule | `cron` (cron expression, e.g. `0 9 * * 1`) |
| `webhook` | Fires when an external webhook is called | Linked via `WebhookEndpoint` |

Trigger nodes inject their event data into the flow context as `triggerData`, accessible via `{{trigger.*}}` variables.

### Conditions

Condition nodes evaluate a boolean expression. If the condition is `true`, execution continues to connected nodes. If `false`, the entire downstream subtree is skipped (short-circuited).

| Type | Description | Config |
|------|-------------|--------|
| `keyword_match` | Checks if trigger text contains specified keywords | `keywords` (string array), `mode` (`any` or `all`) |
| `user_role` | Checks if the triggering user has one of the required roles | `roles` (string array, e.g. `["admin", "moderator"]`) |
| `time_based` | Checks if the current hour falls within a time window | `startHour` (0-23), `endHour` (0-24) |

**KeywordMatch details:**
- `mode: "any"` (default) -- matches if the text contains any of the keywords.
- `mode: "all"` -- matches only if the text contains all keywords.
- Matching is case-insensitive.

**UserRole details:**
- The user's role is read from `triggerData.userRole` (defaults to `"member"`).
- The condition passes if the user's role is in the `roles` array.

**TimeBased details:**
- Uses the server's local time (`new Date().getHours()`).
- The condition passes if `startHour <= currentHour < endHour`.

### Actions

Action nodes perform side effects. They are never cached by the execution engine.

| Type | Description | Config |
|------|-------------|--------|
| `send_message` | Sends a text message to a chat | `chatId` (default: `{{trigger.chatId}}`), `text` |
| `forward_message` | Forwards a message between chats | `fromChatId`, `toChatId`, `messageId` (default: `{{trigger.messageId}}`) |
| `ban_user` | Bans a user from a chat | `chatId`, `userId` (defaults from trigger), `reason` |
| `mute_user` | Mutes a user for a duration | `chatId`, `userId` (defaults from trigger), `durationSeconds` (default: 3600) |
| `api_call` | Makes an HTTP request to an external API | `url`, `method` (default: `GET`), `body`, `timeoutMs` (default: 10000) |
| `delay` | Pauses execution for a specified duration | `delayMs` (default: 1000, max: 30000) |
| `bot_action` | Sends a command to a registered bot instance via its API | `botInstanceId`, `action`, `params` |

**APICall details:**
- Supports all HTTP methods. The `Content-Type` header is set to `application/json`.
- If the request exceeds `timeoutMs`, the node throws an `AbortError`.
- The output contains `{ status, data }` from the response.

**BotAction details:**
- Looks up the bot instance in the database by `botInstanceId`.
- The bot must be active and have an `apiUrl` configured.
- Calls `POST {apiUrl}/api/send-message` with the action and parameters.

### Control Flow

Control flow nodes provide advanced execution patterns.

| Type | Description | Config |
|------|-------------|--------|
| `loop` | Iterates over an array variable, executing child nodes for each item | `arrayVariable` (name of a context variable holding an array) |
| `switch` | Routes execution to different branches based on a value | `switchValue` (template string), `cases` (array of `{value, output}`), `defaultOutput` |
| `transform` | Transforms a string input using a specified operation | `operation`, `input`, plus operation-specific config |
| `parallel_branch` | Executes multiple connected branches concurrently | Automatically uses connected downstream nodes as branches |
| `db_query` | Runs a read-only database query (allowlisted operations only) | `query`, `where`, `select`, `take` (max: 100), `skip` |
| `notification` | Sends a notification through a specified channel | `channel` (default: `websocket`), `message` |

**Loop details:**
- Sets `loop.index` and `loop.item` variables during each iteration.
- These variables are cleaned up after the loop completes.

**Transform operations:**
- `uppercase` / `lowercase` / `trim` -- string transformations.
- `json_parse` / `json_stringify` -- JSON conversion.
- `split` -- splits by `delimiter` (default: `,`), returns an array.
- `regex_extract` -- extracts the first match of `pattern` from the input.
- `passthrough` -- returns the input unchanged.

**DatabaseQuery allowlist:**
- `user.count`, `user.findMany`
- `product.count`, `product.findMany`
- `broadcastMessage.count`

Only these queries are permitted to prevent arbitrary database access.

---

## Variable System

The flow engine uses a template interpolation system to pass data between nodes. Variables are referenced with double-brace syntax: `{{path.to.value}}`.

### Variable Sources

There are three sources of variables, resolved in this order:

1. **Trigger data** (`{{trigger.*}}`) -- data from the event that started the flow.
   - `{{trigger.chatId}}` -- the chat where the event occurred.
   - `{{trigger.userId}}` -- the user who triggered the event.
   - `{{trigger.text}}` -- message text (for message triggers).
   - `{{trigger.userName}}` -- the user's display name.
   - `{{trigger.messageId}}` -- the message ID.
   - `{{trigger.userRole}}` -- the user's role in the group.

2. **Node results** (`{{node.<nodeId>.*}}`) -- output from previously executed nodes.
   - `{{node.action-1.status}}` -- HTTP status code from an API call node.
   - `{{node.condition-1.matched}}` -- whether a condition matched.
   - Supports nested access: `{{node.action-1.data.fieldName}}`.

3. **Context variables** (`{{variableName}}`) -- custom variables set during execution.
   - Set via the `Transform` node or `Loop` node.
   - `{{loop.index}}` and `{{loop.item}}` are available inside loops.
   - Parallel branch results: `{{parallel.<branchId>}}`.

### Resolution Rules

- If a variable path cannot be resolved, the original `{{...}}` placeholder is left unchanged in the output string.
- Nested object access uses dot notation (e.g., `{{trigger.from.firstName}}`).
- All resolved values are converted to strings via `String()`.

---

## Templates

The flow builder includes pre-built templates to help you get started quickly. Each template provides a complete flow with nodes and edges that you can customize.

### Welcome New Members
- **Category:** Community
- **Trigger:** `user_joins`
- **Behavior:** Sends a welcome message when a user joins the group. The message includes the user's name via `{{trigger.userName}}`.

### Spam Escalation
- **Category:** Moderation
- **Trigger:** `message_received`
- **Behavior:** Checks incoming messages for spam keywords (`buy now`, `free money`, `click here`). If any keyword matches, the user is muted for 1 hour.

### Scheduled Broadcast
- **Category:** Automation
- **Trigger:** `schedule` (cron: `0 9 * * 1` -- every Monday at 9:00)
- **Behavior:** Sends a broadcast message to a configured chat on a recurring schedule.

### Cross-Post Messages
- **Category:** Automation
- **Trigger:** `message_received`
- **Behavior:** When a message is received, checks if the sender is an admin or moderator. If so, forwards the message to a target chat.

---

## Error Handling

Each node can configure its own error handling strategy via the `errorHandling` config property. If not set, the executor's default is used (`stop`).

| Strategy | Behavior |
|----------|----------|
| `stop` | Halt the entire flow immediately. No further nodes are executed. This is the default. |
| `skip` | Log the error and continue to the next nodes in the graph. |
| `retry` | Retry the node (implementation depends on the executor configuration). |

When a node errors:
1. Its result is recorded with `status: "error"` and the error message.
2. The error handling strategy is checked.
3. With `stop`, the BFS loop breaks immediately.
4. With `skip`, downstream nodes are still queued for execution.

---

## Expression Builder

The expression builder is a visual UI component for constructing complex boolean conditions in the dashboard. It uses a two-level grouping model.

### Structure

An expression consists of:
- **Top-level logic** (`AND` or `OR`) -- determines how groups relate to each other.
- **Condition groups** -- each group has its own internal logic (`AND` or `OR`) and contains one or more conditions.

### Operators

| Operator | Description |
|----------|-------------|
| `equals` | Exact string match |
| `contains` | Substring match |
| `regex` | Regular expression match |
| `gt` | Greater than (numeric comparison) |
| `lt` | Less than (numeric comparison) |

### Available Fields

By default, conditions can reference these trigger data fields:
- `trigger.userId`
- `trigger.chatId`
- `trigger.text`
- `trigger.userRole`
- `trigger.messageId`

### Example

To match messages from admins that contain either "announce" or "update":

```
Match ALL groups:
  Group 1 (AND):
    trigger.userRole equals "admin"
  Group 2 (OR):
    trigger.text contains "announce"
    trigger.text contains "update"
```

This evaluates as: `(userRole == "admin") AND (text contains "announce" OR text contains "update")`.

---

## Version History

The flow builder supports versioning and rollback for flow definitions.

### How It Works

1. **Creating a version:** Call the version endpoint to snapshot the current `nodesJson` and `edgesJson` of a flow. Each version is assigned an auto-incrementing version number.
2. **Listing versions:** Retrieve all versions for a flow, ordered by version number (newest first).
3. **Restoring a version:** Roll back a flow to a previous version. This overwrites the current `nodesJson` and `edgesJson` with the stored snapshot.

### Data Model

Each version stores:
- `flowId` -- which flow this version belongs to.
- `version` -- integer version number (1, 2, 3, ...).
- `nodesJson` -- snapshot of the nodes at that point.
- `edgesJson` -- snapshot of the edges at that point.
- `createdBy` -- optional identifier of who created the version.
- `createdAt` -- timestamp.

### Best Practices for Versioning

- Create a version before making significant changes to a flow.
- Create a version before activating a flow in production.
- Use version descriptions (via `createdBy`) to annotate what changed.

---

## Best Practices

### Flow Design

- **Start simple.** Begin with a trigger and a single action, then add conditions and branching as needed.
- **Use descriptive labels.** Give each node a clear label that explains its purpose (e.g., "Check if admin" rather than "Condition 1").
- **Validate before activating.** Always run validation to catch missing triggers, cycles, or broken edge references.
- **Test with simulated data.** Use the test execution feature to run your flow with mock trigger data before going live.

### Performance

- **Keep flows under 100 nodes.** The executor enforces a maximum node limit (default: 100) to prevent runaway execution.
- **Use conditions early.** Place condition nodes near the start of your flow to short-circuit unnecessary work. The engine skips entire subtrees when a condition fails.
- **Minimize delays.** The `delay` action caps at 30 seconds. Use scheduled triggers instead of long chains of delays.
- **Leverage caching.** The engine automatically caches results from pure nodes (conditions, transforms). Side-effect nodes (actions, DB queries) are never cached.

### Error Handling

- **Use `skip` for non-critical actions.** If a notification or API call failure should not stop the flow, set `errorHandling: "skip"`.
- **Use `stop` for critical actions.** If a ban or mute fails, you probably want to halt the flow rather than continue with inconsistent state.
- **Monitor execution history.** Check the flow analytics dashboard for error rates and common failure messages.

### Variables

- **Prefer trigger defaults.** Actions like `send_message` and `ban_user` default to `{{trigger.chatId}}` and `{{trigger.userId}}` -- you only need to override these for cross-chat operations.
- **Check variable resolution.** If a template variable cannot be resolved, the raw `{{...}}` string is left in place. Test your flows to ensure all variables resolve correctly.
