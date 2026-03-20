import { pino } from 'pino'
import { GramJsClient } from '@flowbot/telegram-user-connector'

let transport: GramJsClient | null = null

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['*.session', '*.sessionString', 'session'],
})

export async function getTelegramTransport(): Promise<GramJsClient> {
  if (transport && transport.isConnected()) {
    return transport
  }

  const apiId = Number(process.env.TG_CLIENT_API_ID)
  const apiHash = process.env.TG_CLIENT_API_HASH
  const session = process.env.TG_CLIENT_SESSION ?? ''

  if (!apiId || !apiHash) {
    throw new Error('TG_CLIENT_API_ID and TG_CLIENT_API_HASH are required')
  }

  transport = new GramJsClient({
    apiId,
    apiHash,
    sessionString: session,
    logger: logger.child({ component: 'gramjs' }),
  })

  await transport.connect()
  return transport
}

export function getTelegramLogger() {
  return logger
}
