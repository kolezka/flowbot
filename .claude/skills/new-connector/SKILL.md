---
name: new-connector
description: Scaffold a new platform connector package and thin shell app following the platform-kit pattern
---

# New Connector Scaffold

Scaffold a new platform connector and its thin shell app. The user provides `PLATFORM` (e.g. `signal`) and `TRANSPORT_TYPE` (`bot` or `user`). Derive all names from those two values.

## Naming Conventions

```
CONNECTOR_PKG  = packages/${PLATFORM}-${TRANSPORT_TYPE}-connector
APP_DIR        = apps/${PLATFORM}-${TRANSPORT_TYPE}
PKG_NAME       = @flowbot/${PLATFORM}-${TRANSPORT_TYPE}-connector
APP_NAME       = @flowbot/${PLATFORM}-${TRANSPORT_TYPE}
CLASS_NAME     = ${PascalPlatform}${PascalType}Connector   (e.g. SignalBotConnector)
TRANSPORT_IF   = I${PascalPlatform}${PascalType}Transport  (e.g. ISignalBotTransport)
```

## Step 1 — Confirm inputs

Ask the user for:
1. **Platform name** (lowercase, e.g. `signal`, `slack`, `matrix`)
2. **Transport type** (`bot` or `user`)
3. **Platform SDK package** (npm name + version, e.g. `signal-bot-sdk@^1.0.0`)
4. **Default server port** (pick the next unused port — existing: telegram-bot 3001, telegram-user 3002, whatsapp-user 3004, discord-bot 3005)

## Step 2 — Scaffold connector package

Create `${CONNECTOR_PKG}/` with this structure:

```
packages/${PLATFORM}-${TRANSPORT_TYPE}-connector/
├── src/
│   ├── index.ts                  # Public exports
│   ├── connector.ts              # Main connector class
│   ├── sdk/
│   │   ├── types.ts              # Transport interface
│   │   └── fake-transport.ts     # Test double
│   ├── actions/
│   │   ├── schemas.ts            # Valibot action schemas
│   │   └── messaging.ts          # registerMessagingActions()
│   └── events/
│       ├── mapper.ts             # Platform events → FlowTriggerEvent
│       └── listeners.ts          # registerEventListeners()
├── __tests__/
│   └── connector.test.ts         # Basic connector test with FakeTransport
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### package.json

```json
{
  "name": "${PKG_NAME}",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "test": "vitest run"
  },
  "dependencies": {
    "@flowbot/platform-kit": "workspace:*",
    "pino": "9.9.0",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

Do NOT add the platform SDK to dependencies yet — the real transport implementation is deferred.

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "noEmit": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true } })
```

### src/sdk/types.ts — Transport interface

```ts
import type { Logger } from 'pino'

export interface ${TRANSPORT_IF} {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isRunning(): boolean

  // Messaging (add platform-specific methods later)
  sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<MessageResult>
}

export interface SendMessageOptions {
  parseMode?: string
}

export interface MessageResult {
  messageId: string
}
```

### src/sdk/fake-transport.ts — Test double

```ts
import type { ${TRANSPORT_IF}, MessageResult, SendMessageOptions } from './types.js'

export class Fake${PascalPlatform}Transport implements ${TRANSPORT_IF} {
  readonly sentMessages: Array<{ chatId: string; text: string; options?: SendMessageOptions }> = []
  private running = false

  async connect(): Promise<void> { this.running = true }
  async disconnect(): Promise<void> { this.running = false }
  isRunning(): boolean { return this.running }

  async sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<MessageResult> {
    this.sentMessages.push({ chatId, text, options })
    return { messageId: String(this.sentMessages.length) }
  }
}
```

### src/actions/schemas.ts

```ts
import * as v from 'valibot'

export const sendMessageSchema = v.object({
  chatId: v.string(),
  text: v.string(),
  parseMode: v.optional(v.string()),
})
```

### src/actions/messaging.ts

```ts
import type { ActionRegistry } from '@flowbot/platform-kit'
import type { ${TRANSPORT_IF} } from '../sdk/types.js'
import { sendMessageSchema } from './schemas.js'

export function registerMessagingActions(registry: ActionRegistry, transport: ${TRANSPORT_IF}): void {
  registry.register('send_message', {
    schema: sendMessageSchema,
    handler: async (params) =>
      transport.sendMessage(params.chatId, params.text, {
        parseMode: params.parseMode,
      }),
  })
}
```

### src/events/mapper.ts

```ts
import type { FlowTriggerEvent } from '@flowbot/platform-kit'

export function mapMessageEvent(
  // Replace `unknown` with the platform's native event type
  rawEvent: unknown,
  botInstanceId: string,
): FlowTriggerEvent | null {
  // TODO: Implement platform-specific event mapping
  return null
}
```

### src/events/listeners.ts

```ts
import type { EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'

export function registerEventListeners(
  // Replace `unknown` with the platform's native client type
  client: unknown,
  forwarder: EventForwarder,
  botInstanceId: string,
  logger: Logger,
): void {
  // TODO: Register platform-specific event listeners
  // Pattern:
  //   client.on('message', async (event) => {
  //     const mapped = mapMessageEvent(event, botInstanceId)
  //     if (mapped) await forwarder.send(mapped)
  //   })
}
```

### src/connector.ts

```ts
import { ActionRegistry, EventForwarder } from '@flowbot/platform-kit'
import type { Logger } from 'pino'
import type { ${TRANSPORT_IF} } from './sdk/types.js'
import { registerMessagingActions } from './actions/messaging.js'
import { registerEventListeners } from './events/listeners.js'

export interface ${CLASS_NAME}Config {
  botInstanceId: string
  apiUrl: string
  logger: Logger
  transport?: ${TRANSPORT_IF}
  // Add platform-specific config (tokens, keys, etc.)
}

export class ${CLASS_NAME} {
  readonly registry = new ActionRegistry()
  private transport: ${TRANSPORT_IF} | null = null
  private readonly forwarder: EventForwarder
  private readonly logger: Logger
  private readonly config: ${CLASS_NAME}Config

  constructor(config: ${CLASS_NAME}Config) {
    this.config = config
    this.logger = config.logger
    this.forwarder = new EventForwarder({
      apiUrl: config.apiUrl,
      logger: config.logger,
    })
  }

  async connect(): Promise<void> {
    if (this.config.transport !== undefined) {
      this.transport = this.config.transport
    } else {
      // TODO: Import and instantiate real transport
      throw new Error('Real transport not yet implemented')
    }

    this.registerActions()
    registerEventListeners(this.transport, this.forwarder, this.config.botInstanceId, this.logger)
    await this.transport.connect()
    this.logger.info('${CLASS_NAME} connected')
  }

  async disconnect(): Promise<void> {
    if (this.transport !== null) {
      await this.transport.disconnect()
    }
  }

  isConnected(): boolean {
    return this.transport?.isRunning() ?? false
  }

  private registerActions(): void {
    if (this.transport === null) throw new Error('Transport not initialized')
    registerMessagingActions(this.registry, this.transport)
  }
}
```

### src/index.ts

```ts
export { ${CLASS_NAME} } from './connector.js'
export type { ${CLASS_NAME}Config } from './connector.js'
export type { ${TRANSPORT_IF} } from './sdk/types.js'
```

### __tests__/connector.test.ts

```ts
import { describe, it, expect } from 'vitest'
import { ${CLASS_NAME} } from '../src/connector.js'
import { Fake${PascalPlatform}Transport } from '../src/sdk/fake-transport.js'
import pino from 'pino'

const logger = pino({ level: 'silent' })

describe('${CLASS_NAME}', () => {
  it('connects with fake transport', async () => {
    const transport = new Fake${PascalPlatform}Transport()
    const connector = new ${CLASS_NAME}({
      botInstanceId: 'test-instance',
      apiUrl: 'http://localhost:3000',
      logger,
      transport,
    })

    await connector.connect()
    expect(connector.isConnected()).toBe(true)

    await connector.disconnect()
    expect(connector.isConnected()).toBe(false)
  })

  it('executes send_message action', async () => {
    const transport = new Fake${PascalPlatform}Transport()
    const connector = new ${CLASS_NAME}({
      botInstanceId: 'test-instance',
      apiUrl: 'http://localhost:3000',
      logger,
      transport,
    })

    await connector.connect()
    const result = await connector.registry.execute('send_message', {
      chatId: '123',
      text: 'hello',
    })

    expect(result.success).toBe(true)
    expect(transport.sentMessages).toHaveLength(1)
    expect(transport.sentMessages[0]).toEqual({
      chatId: '123',
      text: 'hello',
      options: { parseMode: undefined },
    })
  })
})
```

## Step 3 — Scaffold thin shell app

Create `${APP_DIR}/` with this structure:

```
apps/${PLATFORM}-${TRANSPORT_TYPE}/
├── src/
│   ├── main.ts                   # Entry point
│   └── config.ts                 # Valibot env config
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### package.json

```json
{
  "name": "${APP_NAME}",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "tsx watch ./src/main.ts",
    "start": "tsx ./src/main.ts",
    "typecheck": "tsc",
    "build": "tsc --noEmit false",
    "test": "vitest run",
    "lint": "echo 'no linter configured'"
  },
  "dependencies": {
    "@flowbot/db": "workspace:*",
    "@flowbot/platform-kit": "workspace:*",
    "${PKG_NAME}": "workspace:*",
    "pino": "9.9.0",
    "pino-pretty": "13.0.0",
    "tsx": "4.20.4",
    "valibot": "0.42.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.9.2",
    "vitest": "^3.2.1"
  }
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "noEmit": false,
    "outDir": "dist",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true } })
```

### src/config.ts

```ts
import * as v from 'valibot'

const configSchema = v.object({
  botInstanceId: v.pipe(v.string(), v.minLength(1)),
  apiUrl: v.optional(v.string(), 'http://localhost:3000'),
  serverHost: v.optional(v.string(), '0.0.0.0'),
  serverPort: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number()),
    '${DEFAULT_PORT}',
  ),
  logLevel: v.optional(
    v.picklist(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
    'info',
  ),
  // Add platform-specific env vars here (tokens, keys, etc.)
})

export type Config = v.InferOutput<typeof configSchema>

export function createConfigFromEnvironment(): Config {
  return v.parse(configSchema, {
    botInstanceId: process.env['BOT_INSTANCE_ID'],
    apiUrl: process.env['API_URL'],
    serverHost: process.env['SERVER_HOST'],
    serverPort: process.env['SERVER_PORT'],
    logLevel: process.env['LOG_LEVEL'],
  })
}
```

### src/main.ts

```ts
import pino from 'pino'
import { createConnectorServer, createServerManager } from '@flowbot/platform-kit'
import { ${CLASS_NAME} } from '${PKG_NAME}'
import { createConfigFromEnvironment } from './config.js'

const config = createConfigFromEnvironment()
const logger = pino({ level: config.logLevel })

const connector = new ${CLASS_NAME}({
  botInstanceId: config.botInstanceId,
  apiUrl: config.apiUrl,
  logger,
})

const server = createConnectorServer({
  registry: connector.registry,
  logger,
  healthCheck: () => connector.isConnected(),
})

const serverManager = createServerManager(server, {
  host: config.serverHost,
  port: config.serverPort,
})

async function start(): Promise<void> {
  await connector.connect()
  const info = await serverManager.start()
  logger.info({ url: info.url }, '${CLASS_NAME} started')
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down...')
  await connector.disconnect()
  await serverManager.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start')
  process.exit(1)
})
```

## Step 4 — Wire into monorepo

1. Add workspace filter to root `package.json` scripts:
   ```json
   "${PLATFORM}-${TRANSPORT_TYPE}": "pnpm --filter ${APP_NAME}",
   "${PLATFORM}-${TRANSPORT_TYPE}-connector": "pnpm --filter ${PKG_NAME}"
   ```

2. Run `pnpm install` to link workspaces.

3. Run `pnpm ${PLATFORM}-${TRANSPORT_TYPE}-connector test` to verify the scaffold.

## Step 5 — Next steps checklist

Tell the user what remains after scaffolding:

- [ ] Add platform SDK dependency to the connector package
- [ ] Implement real transport in `sdk/${PLATFORM}-client.ts`
- [ ] Implement event mapper in `events/mapper.ts`
- [ ] Register event listeners in `events/listeners.ts`
- [ ] Add platform-specific actions beyond `send_message`
- [ ] Add platform-specific config fields (tokens, keys) to `config.ts`
- [ ] Add env vars to CLAUDE.md environment table
- [ ] Add workspace entries to CLAUDE.md workspace table
