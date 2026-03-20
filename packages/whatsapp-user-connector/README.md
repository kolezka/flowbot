# @flowbot/whatsapp-user-connector

WhatsApp user account connector using Baileys (multi-device). Handles user-account messaging and group administration via WhatsApp Web.

## Usage

```typescript
import { WhatsAppUserConnector } from '@flowbot/whatsapp-user-connector'
import { setupQrAuth } from '@flowbot/whatsapp-user-connector'

const connector = new WhatsAppUserConnector({
  connectionId: 'conn_123',
  botInstanceId: 'bot_instance_123',
  prisma: prismaClient,
  logger: pino(),
  apiUrl: 'http://api:3000',
})

await connector.connect()

// QR auth on first connection
await setupQrAuth(transport, connectionId, prisma, logger)
```

## API

**WhatsAppUserConnector**: Main connector for user-account operations. Uses Baileys multi-device protocol.

**BaileysClient**: Wraps Baileys library with session persistence in database and automatic reconnection.

**Action Groups**:
- Messaging: `send_message`, `send_media`, `send_contact`, `send_location`, `edit_message`, `delete_message`
- Group Admin: `ban_user`, `promote_user`, `demote_user`, `set_group_title`, `set_group_description`
- Message Management: `pin_message`, `unpin_message`, `mark_as_read`
- Presence: `set_presence_online`, `set_presence_typing`

**Auth**: QR code authentication. Session stored in `PlatformConnection.credentials` for auto-reconnect.

**Event Forwarding**: Forwards incoming messages and status changes to the flow engine.

## Testing

```bash
pnpm whatsapp-user-connector test
```
