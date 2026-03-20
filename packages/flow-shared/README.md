# @flowbot/flow-shared

Shared flow engine types and node registry. Platform-agnostic flow definitions and node metadata.

## Usage

```typescript
import { NODE_TYPES, getNodesByPlatform, getNodesByCategory } from '@flowbot/flow-shared'
import type { NodeTypeDefinition } from '@flowbot/flow-shared'

// Get all Telegram trigger nodes
const telegramTriggers = getNodesByPlatform('telegram')
  .filter(n => n.category === 'trigger')

// Get action nodes by category
const messagingActions = getNodesByCategory('action')
```

## API

**NODE_TYPES**: Registry of all available flow node types with metadata (label, category, platform, color, subcategory).

**NodeTypeDefinition**: TypeScript interface describing node metadata:
- `type`: Node identifier
- `label`: Human-readable label
- `category`: 'trigger' | 'condition' | 'action' | 'advanced' | 'annotation'
- `platform`: 'telegram' | 'discord' | 'general'
- `color`: UI color code
- `subcategory`: Optional group (e.g., 'user_account' for MTProto-only nodes)
- `requiresConnection`: Whether node needs a PlatformConnection

**Node Categories**:
- Triggers: message_received, user_joins, user_leaves, callback_query, command_received, schedule, webhook, etc.
- Conditions: keyword_match, user_role, time_based, message_type, regex_match, etc.
- Actions: send_message, send_media, forward_message, ban_user, promote_user, etc.

**Utilities**: `getNodesByPlatform(platform)`, `getNodesByCategory(category)` for filtering nodes.
