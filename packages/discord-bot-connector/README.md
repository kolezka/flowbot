# @flowbot/discord-bot-connector

Discord bot connector using discord.js framework. Handles bot-account messaging, admin actions, and event forwarding to the flow engine.

## Usage

```typescript
import { DiscordBotConnector } from '@flowbot/discord-bot-connector'
import { DiscordClient, FakeDiscordClient } from '@flowbot/discord-bot-connector'

const connector = new DiscordBotConnector({
  botToken: 'YOUR_BOT_TOKEN',
  botInstanceId: 'bot_instance_123',
  logger: pino(),
  apiUrl: 'http://api:3000',
})

await connector.connect()
```

## API

**DiscordBotConnector**: Main connector class. Bootstraps discord.js bot, registers action handlers, and forwards events to the flow engine.

**Action Groups**:
- Messaging: `send_message`, `send_embed`, `send_dm`, `edit_message`, `delete_message`, `pin_message`, `add_reaction`
- Admin: `ban_member`, `kick_member`, `timeout_member`, `create_role`, `create_invite`
- Channel: `create_channel`, `create_thread`, `move_member`, `create_scheduled_event`

**Event Mapper**: Converts discord.js events to flow engine events (`message_received`, `member_join`, `member_leave`, `interaction`, `reaction_add`, `voice_state_update`).

**Event Listeners**: Registers handlers for incoming Discord events and forwards them to the flow engine.

## Testing

```bash
pnpm discord-bot-connector test
```
