# @flowbot/telegram-user-connector

Telegram user account connector using GramJS (MTProto). Executes user-account actions like reading history, joining groups, and managing permissions.

## Usage

```typescript
import { TelegramUserConnector } from '@flowbot/telegram-user-connector'
import { GramJsClient } from '@flowbot/telegram-user-connector'

const connector = new TelegramUserConnector({
  sessionString: 'YOUR_SESSION_STRING',
  apiId: 12345,
  apiHash: 'YOUR_API_HASH',
  logger: pino(),
})

await connector.connect()
```

## API

**TelegramUserConnector**: Main connector for user-account operations. Requires MTProto session credentials.

**GramJsClient**: Wraps GramJS library with connection management and error handling.

**Action Groups**:
- Messaging: `send_message`, `send_photo`, `send_video`, `send_document`, `forward_message`, `edit_message`, `delete_message`
- User Actions: `join_chat`, `leave_chat`, `ban_user`, `restrict_user`, `promote_user`, `get_chat_member`, `resolve_username`

**Schemas**: Valibot schemas for all actions with type-safe payload validation.

## Testing

```bash
pnpm telegram-user-connector test
```
