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

#### Discord Triggers

| Type | Description | Config |
|------|-------------|--------|
| `discord_message_received` | Fires when a message is sent in a Discord channel | None required |
| `discord_member_join` | Fires when a new member joins a Discord server | None required |
| `discord_member_leave` | Fires when a member leaves a Discord server | None required |
| `discord_reaction_add` | Fires when a reaction is added to a message | None required |
| `discord_reaction_remove` | Fires when a reaction is removed from a message | None required |
| `discord_interaction_create` | Fires when a slash command or interaction is used | None required |
| `discord_voice_state_update` | Fires when a user joins/leaves/moves voice channels | None required |

Discord triggers inject platform-specific data into `triggerData`:
- `{{trigger.guildId}}` -- the Discord server ID
- `{{trigger.channelId}}` -- the channel ID
- `{{trigger.userId}}` -- the user's Discord ID
- `{{trigger.username}}` -- the user's Discord username
- `{{trigger.content}}` -- message text (for message triggers)
- `{{trigger.platform}}` -- always `"discord"` for Discord events
- `{{trigger.timestamp}}` -- ISO 8601 event timestamp

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

#### Discord Conditions

| Type | Description | Config |
|------|-------------|--------|
| `discord_has_role` | Checks if the triggering member has a specific role | `roleId` (string) |
| `discord_channel_type` | Checks if the channel type matches the expected type | `channelType` (string, e.g. `"GUILD_TEXT"`, `"GUILD_VOICE"`) |
| `discord_is_bot` | Checks if the triggering user is a bot | `matchBots` (boolean, default: `true`; set `false` to match non-bots) |
| `discord_message_has_embed` | Checks if the message contains embeds | None required |
| `discord_member_permissions` | Checks if the member has required permissions | `permissions` (string array, e.g. `["MANAGE_MESSAGES", "BAN_MEMBERS"]`) |

**DiscordHasRole details:**
- The role ID list is read from `triggerData.roles`.
- The condition passes if the specified `roleId` is in the member's roles.

**DiscordMemberPermissions details:**
- Requires all listed permissions to pass.
- Permission strings follow Discord's permission names (e.g. `MANAGE_MESSAGES`, `ADMINISTRATOR`).

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

#### Discord Actions

Discord actions are prefixed with `discord_` and dispatched to the Discord bot's HTTP API.

| Type | Description | Config |
|------|-------------|--------|
| `discord_send_message` | Send a text message to a channel | `channelId` (default: `{{trigger.channelId}}`), `content` |
| `discord_send_embed` | Send a rich embed | `channelId`, `embed` (object with title, description, color, fields, footer, thumbnail, image) |
| `discord_send_dm` | Send a direct message to a user | `userId` (default: `{{trigger.userId}}`), `content` |
| `discord_edit_message` | Edit an existing message | `channelId`, `messageId`, `content` |
| `discord_delete_message` | Delete a message | `channelId`, `messageId` |
| `discord_add_reaction` | Add a reaction emoji to a message | `channelId`, `messageId`, `emoji` |
| `discord_remove_reaction` | Remove a reaction from a message | `channelId`, `messageId`, `emoji` |
| `discord_pin_message` | Pin a message | `channelId`, `messageId` |
| `discord_unpin_message` | Unpin a message | `channelId`, `messageId` |
| `discord_ban_member` | Ban a member from the guild | `guildId` (default: `{{trigger.guildId}}`), `userId`; optional: `reason`, `deleteMessageDays` |
| `discord_kick_member` | Kick a member | `guildId`, `userId`; optional: `reason` |
| `discord_timeout_member` | Timeout (mute) a member | `guildId`, `userId`, `durationMs`; optional: `reason` |
| `discord_add_role` | Add a role to a member | `guildId`, `userId`, `roleId` |
| `discord_remove_role` | Remove a role from a member | `guildId`, `userId`, `roleId` |
| `discord_create_role` | Create a new role | `guildId`, `name`; optional: `color`, `permissions` |
| `discord_set_nickname` | Set a member's nickname | `guildId`, `userId`, `nickname` |
| `discord_create_channel` | Create a channel | `guildId`, `name`; optional: `type`, `options` |
| `discord_delete_channel` | Delete a channel | `channelId` |
| `discord_move_member` | Move a member to a voice channel | `guildId`, `userId`, `channelId` |
| `discord_create_thread` | Create a thread | `channelId`, `name`; optional: `options` |
| `discord_send_thread_message` | Send a message to a thread | `threadId`, `content` |
| `discord_create_invite` | Create a channel invite | `channelId`; optional: `options` |
| `discord_create_scheduled_event` | Create a scheduled event | `guildId`, `name`; optional: `options` |

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

1. **Trigger data** (`{{trigger.*}}`) -- data from the event that started the flow. The available fields depend on which platform triggered the flow.

   **Telegram trigger variables:**
   - `{{trigger.chatId}}` -- the chat where the event occurred.
   - `{{trigger.userId}}` -- the user who triggered the event.
   - `{{trigger.text}}` -- message text (for message triggers).
   - `{{trigger.messageText}}` -- message text (alias for `text`, for cross-platform compatibility).
   - `{{trigger.userName}}` -- the user's display name.
   - `{{trigger.messageId}}` -- the message ID.
   - `{{trigger.userRole}}` -- the user's role in the group.

   **Discord trigger variables:**
   - `{{trigger.guildId}}` -- the Discord server (guild) ID.
   - `{{trigger.channelId}}` -- the channel where the event occurred.
   - `{{trigger.userId}}` -- the Discord user ID (snowflake).
   - `{{trigger.authorId}}` -- the Discord user ID (alias for `userId`, for cross-platform clarity).
   - `{{trigger.username}}` -- the Discord username.
   - `{{trigger.content}}` -- message text content.
   - `{{trigger.messageId}}` -- the message snowflake ID.

   **Shared variables (all platforms):**
   - `{{trigger.platform}}` -- `"telegram"` or `"discord"`.
   - `{{trigger.timestamp}}` -- ISO 8601 timestamp of the event.

   The template system resolves any key present in the trigger data dynamically -- there is no hardcoded list of supported variables. If a platform forwarder includes a field in `triggerData`, it is automatically accessible as `{{trigger.<fieldName>}}`.

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

**Telegram fields:**
- `trigger.userId`
- `trigger.chatId`
- `trigger.text`
- `trigger.userRole`
- `trigger.messageId`

**Discord fields:**
- `trigger.userId`
- `trigger.guildId`
- `trigger.channelId`
- `trigger.content`
- `trigger.username`
- `trigger.messageId`

**Shared fields:**
- `trigger.platform`
- `trigger.timestamp`

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

## Platform Filtering

When designing flows, nodes are platform-aware. The flow builder UI supports filtering nodes by platform to simplify the palette:

- **All** -- shows all available triggers, conditions, and actions.
- **Telegram** -- shows only Telegram-specific nodes (no `discord_` prefix).
- **Discord** -- shows only Discord-specific nodes (`discord_` prefixed triggers, conditions, and actions).
- **Shared** -- shows platform-agnostic nodes: `schedule`, `webhook`, `keyword_match`, `time_based`, `api_call`, `delay`, `transform`, `loop`, `switch`, `parallel_branch`, `db_query`, `notification`.

Shared nodes work identically regardless of which platform triggered the flow. For example, a `keyword_match` condition reads from `triggerData.text` (Telegram) or `triggerData.content` (Discord) -- both are set by their respective trigger events.

---

## Cross-Platform Flow Examples

### Discord Message to Telegram Notification

A flow that watches for messages containing "alert" in a Discord channel and sends a notification to a Telegram group.

```
Nodes:
  1. [Trigger] discord_message_received
  2. [Condition] keyword_match
       keywords: ["alert"]
       mode: "any"
  3. [Action] send_message (Telegram)
       chatId: "-1001234567890"
       text: "Alert from Discord ({{trigger.username}}): {{trigger.content}}"

Edges:
  1 -> 2 -> 3
```

### Telegram User Join to Discord Welcome

A flow that notifies a Discord channel when someone joins a Telegram group.

```
Nodes:
  1. [Trigger] user_joins
  2. [Action] discord_send_embed
       channelId: "1234567890123456789"
       embed:
         title: "New Telegram Member"
         description: "{{trigger.userName}} just joined the Telegram group!"
         color: 5025616

Edges:
  1 -> 2
```

### Multi-Platform Moderation Sync

A flow that bans a user on Discord when they are banned on Telegram (using a webhook trigger from the moderation system).

```
Nodes:
  1. [Trigger] webhook
       (linked to a WebhookEndpoint that receives ban events)
  2. [Condition] keyword_match
       keywords: ["ban"]
       mode: "any"
  3. [Action] discord_ban_member
       guildId: "987654321098765432"
       userId: "{{trigger.discordUserId}}"
       reason: "Cross-platform ban sync from Telegram"

Edges:
  1 -> 2 -> 3
```

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
