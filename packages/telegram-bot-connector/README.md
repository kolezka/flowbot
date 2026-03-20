# @flowbot/telegram-bot-connector

Telegram bot connector using grammY framework. Handles bot-account messaging, admin actions, and event forwarding to the flow engine.

## Usage

```typescript
import { TelegramBotConnector } from '@flowbot/telegram-bot-connector'
import { GrammyBot, FakeTelegramBot } from '@flowbot/telegram-bot-connector'

const connector = new TelegramBotConnector({
  botToken: 'YOUR_BOT_TOKEN',
  botInstanceId: 'bot_instance_123',
  logger: pino(),
  apiUrl: 'http://api:3000',
})

await connector.connect()
```

## API

**TelegramBotConnector**: Main connector class. Bootstraps grammY bot, registers action handlers, and forwards events to the flow engine.

**Action Groups**:
- Messaging: `send_message`, `send_photo`, `send_video`, `send_document`, `edit_message`, `delete_message`, `forward_message`, `copy_message`
- Admin: `ban_user`, `restrict_user`, `promote_user`, `set_chat_title`, `set_chat_description`
- Chat: `get_chat_member`, `leave_chat`, `export_invite_link`, `create_forum_topic`
- Message Management: `pin_message`, `unpin_message`, `send_media_group`, `create_poll`

**Event Mapper**: Converts grammY events to flow engine events (`message_received`, `user_joins`, `user_leaves`, `callback_query`).

**Features**: Built-in command handlers (`/start`, `/help`) and menu system.

## Testing

```bash
pnpm telegram-bot-connector test
```
