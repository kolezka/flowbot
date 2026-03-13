# Discord Integration Guide

## Prerequisites

### Discord Developer Portal

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name.
3. Navigate to the **Bot** section and click **Add Bot**.
4. Copy the **Bot Token** -- you will need this for the `DISCORD_BOT_TOKEN` environment variable.
5. Copy the **Application ID** (from the General Information page) -- this is your `DISCORD_CLIENT_ID`.

### Required Intents

The bot requires these **Privileged Gateway Intents** (enable them in the Bot settings page):

| Intent | Purpose |
|--------|---------|
| **Server Members Intent** | Detect member join/leave events |
| **Message Content Intent** | Read message text for flow triggers and keyword matching |

The bot also uses these standard intents (no manual enabling needed):

| Intent | Purpose |
|--------|---------|
| Guilds | Access guild/channel structure |
| Guild Messages | Receive message events |
| Guild Message Reactions | Track reaction add/remove |
| Guild Voice States | Monitor voice channel activity |
| Guild Scheduled Events | Manage scheduled events |

### Inviting the Bot

Generate an invite URL using the OAuth2 URL Generator in the Developer Portal:

1. Go to **OAuth2 > URL Generator**.
2. Select the `bot` and `applications.commands` scopes.
3. Under **Bot Permissions**, select the permissions your flows need (at minimum: Send Messages, Manage Messages, Manage Roles, Ban Members, Kick Members).
4. Copy the generated URL and open it in your browser to invite the bot to your server.

---

## Environment Setup

Add the following variables to your `.env` file (or the `apps/discord-bot/.env` file):

```env
# Required
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-application-id-here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/strefaruchu_db

# Optional
API_URL=http://localhost:3000   # URL of the NestJS API (default: http://localhost:3000)
PORT=3003                       # HTTP server port (default: 3003)
```

---

## Running the Discord Bot

### Development

```bash
pnpm discord-bot dev
```

### Production

```bash
pnpm discord-bot build
pnpm discord-bot start
```

On successful startup you will see:

```
[discord-bot] Client ready as YourBot#1234
[discord-bot] Logged in as YourBot#1234
[discord-bot] HTTP server listening on http://0.0.0.0:3003
```

The bot exposes an HTTP server (Hono) with:
- `GET /health` -- health check endpoint
- `POST /api/execute-action` -- action execution endpoint (called by the Trigger.dev flow dispatcher)

---

## Supported Events / Triggers

The Discord bot listens for events and forwards them to the flow engine as trigger data. Each event is tagged with `platform: 'discord'` and `timestamp`.

| Event Type | Trigger Name | Trigger Data Fields |
|------------|-------------|---------------------|
| Message received | `discord_message_received` | `guildId`, `channelId`, `messageId`, `userId`, `username`, `content`, `hasAttachments`, `attachmentCount` |
| Member joined | `discord_member_join` | `guildId`, `userId`, `username`, `displayName`, `accountCreatedAt` |
| Member left | `discord_member_leave` | `guildId`, `userId`, `username`, `displayName` |
| Reaction added | `discord_reaction_add` | `guildId`, `channelId`, `messageId`, `userId`, `emoji`, `emojiId` |
| Reaction removed | `discord_reaction_remove` | `guildId`, `channelId`, `messageId`, `userId`, `emoji`, `emojiId` |
| Slash command / interaction | `discord_interaction_create` | `guildId`, `channelId`, `userId`, `username`, `interactionType`, `interactionId` |
| Voice state change | `discord_voice_state_update` | `guildId`, `userId`, `username`, `action`, `oldChannelId`, `newChannelId`, `selfMute`, `selfDeaf`, `serverMute`, `serverDeaf`, `streaming` |

### Template Variables

All trigger data fields are accessible as template variables in the flow builder using `{{trigger.<fieldName>}}` syntax. The variable system resolves any key present in `triggerData` automatically.

**Discord-specific variables:**

- `{{trigger.guildId}}` -- the Discord server (guild) ID
- `{{trigger.channelId}}` -- the channel where the event occurred
- `{{trigger.userId}}` -- the Discord user ID (snowflake)
- `{{trigger.username}}` -- the Discord username
- `{{trigger.content}}` -- message text content
- `{{trigger.messageId}}` -- the message snowflake ID

**Shared variables (present on all platforms):**

- `{{trigger.platform}}` -- always `"discord"` for Discord events
- `{{trigger.timestamp}}` -- ISO 8601 timestamp of when the event was forwarded

---

## Supported Actions (22)

All Discord actions are prefixed with `discord_` and dispatched to the Discord bot via its HTTP API.

### Messaging (5)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_send_message` | Send a text message to a channel | `channelId`, `content` |
| `discord_send_embed` | Send a rich embed to a channel | `channelId`, `embed` (title, description, color, fields, footer, thumbnail, image) |
| `discord_send_dm` | Send a direct message to a user | `userId`, `content` |
| `discord_edit_message` | Edit an existing message | `channelId`, `messageId`, `content` |
| `discord_delete_message` | Delete a message | `channelId`, `messageId` |

### Reactions (2)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_add_reaction` | Add a reaction to a message | `channelId`, `messageId`, `emoji` |
| `discord_remove_reaction` | Remove a reaction from a message | `channelId`, `messageId`, `emoji` |

### Pins (2)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_pin_message` | Pin a message in a channel | `channelId`, `messageId` |
| `discord_unpin_message` | Unpin a message | `channelId`, `messageId` |

### Member Moderation (4)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_ban_member` | Ban a member from the guild | `guildId`, `userId`; optional: `reason`, `deleteMessageDays` |
| `discord_kick_member` | Kick a member from the guild | `guildId`, `userId`; optional: `reason` |
| `discord_timeout_member` | Timeout (mute) a member | `guildId`, `userId`, `durationMs`; optional: `reason` |
| `discord_set_nickname` | Change a member's nickname | `guildId`, `userId`, `nickname` |

### Roles (3)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_add_role` | Add a role to a member | `guildId`, `userId`, `roleId` |
| `discord_remove_role` | Remove a role from a member | `guildId`, `userId`, `roleId` |
| `discord_create_role` | Create a new role in the guild | `guildId`, `name`; optional: `color`, `permissions` |

### Channels and Threads (4)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_create_channel` | Create a new channel | `guildId`, `name`; optional: `type`, `options` |
| `discord_delete_channel` | Delete a channel | `channelId` |
| `discord_create_thread` | Create a thread in a channel | `channelId`, `name`; optional: `options` |
| `discord_send_thread_message` | Send a message to a thread | `threadId`, `content` |

### Other (2)

| Action | Description | Required Config |
|--------|-------------|-----------------|
| `discord_move_member` | Move a member to a voice channel | `guildId`, `userId`, `channelId` |
| `discord_create_invite` | Create a channel invite | `channelId`; optional: `options` |
| `discord_create_scheduled_event` | Create a scheduled event | `guildId`, `name`; optional: `options` |

---

## Creating Cross-Platform Flows

The flow engine is platform-agnostic. Trigger data from any platform is stored in the same `triggerData` context, and template variables resolve dynamically from whatever keys are present.

### Example: Discord Trigger to Telegram Action

**Scenario:** When a message containing "announcement" is posted in a Discord channel, forward the content to a Telegram group.

Flow nodes:

1. **Trigger** -- `discord_message_received`
   - No special config needed; the Discord bot forwards the event automatically.

2. **Condition** -- `keyword_match`
   - `keywords`: `["announcement"]`
   - `mode`: `"any"`
   - The condition checks `{{trigger.content}}` (the Discord message text).

3. **Action** -- `send_message` (Telegram)
   - `chatId`: `"-1001234567890"` (your Telegram group ID)
   - `text`: `"Discord announcement from {{trigger.username}}: {{trigger.content}}"`

### Example: Telegram Trigger to Discord Action

**Scenario:** When a new user joins a Telegram group, send a notification to a Discord channel.

Flow nodes:

1. **Trigger** -- `user_joins`
   - Standard Telegram trigger; fires on new member events.

2. **Action** -- `discord_send_message`
   - `channelId`: `"1234567890123456789"` (your Discord channel ID)
   - `content`: `"New Telegram member: {{trigger.userName}} joined the group!"`

### Transport Configuration

Cross-platform flows require the flow definition to include transport configuration:

- `botInstanceId` -- the Telegram bot instance ID (for Telegram actions)
- `discordBotInstanceId` -- the Discord bot instance ID (for Discord actions)
- `transport` -- set to `"auto"` or `"bot_api"` for Telegram actions

The dispatcher automatically routes `discord_*` actions to the Discord bot API and all other actions to Telegram.

---

## Troubleshooting

### Bot does not come online

- Verify `DISCORD_BOT_TOKEN` is correct and the bot has not been regenerated in the Developer Portal.
- Check that the bot has been invited to at least one server.
- Look for error messages in the console output.

### Missing message content

- Ensure the **Message Content Intent** is enabled in the Discord Developer Portal under your application's Bot settings.
- The bot must have the `MessageContent` gateway intent (already configured in `bot/index.ts`).

### Events not triggering flows

- Confirm the `API_URL` environment variable points to the running NestJS API instance.
- Check that the flow webhook endpoint (`/api/flow/webhook`) is accessible from the Discord bot process.
- Verify the flow definition has the correct Discord trigger type (e.g., `discord_message_received`, not `message_received`).
- Check the Discord bot console for `[discord-bot] Flow webhook returned ...` error messages.

### Discord actions fail in flows

- Ensure the Discord bot instance is registered in the database with `isActive: true` and a valid `apiUrl`.
- The flow's `transportConfig` must include a `discordBotInstanceId` pointing to the Discord bot instance.
- Verify the Discord bot's HTTP server is running and the `/api/execute-action` endpoint is reachable.
- Check that the bot has the required permissions in the Discord server for the action (e.g., Ban Members permission for `discord_ban_member`).

### Rate limiting

- Discord has strict rate limits. If you see 429 errors, reduce the frequency of actions.
- The `discord-transport` package includes a CircuitBreaker that will temporarily stop requests if the API is consistently failing.

### Member events not firing

- The **Server Members Intent** must be enabled in the Developer Portal.
- The bot must have the `GuildMembers` gateway intent.
- For large servers (over 75 members), Discord requires the intent to be approved.
