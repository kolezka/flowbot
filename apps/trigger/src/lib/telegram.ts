import { pino } from 'pino'
import { StringSession } from 'telegram/sessions/index.js'
import { GramJsTransport, CircuitBreaker, ActionRunner } from '@flowbot/telegram-transport'

let transport: GramJsTransport | null = null
let circuitBreaker: CircuitBreaker | null = null
let actionRunner: ActionRunner | null = null

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: ['*.session', '*.sessionString', 'session'],
})

export async function getTelegramTransport(): Promise<GramJsTransport> {
  if (transport && transport.isConnected()) {
    return transport
  }

  const apiId = Number(process.env.TG_CLIENT_API_ID)
  const apiHash = process.env.TG_CLIENT_API_HASH
  const session = process.env.TG_CLIENT_SESSION

  if (!apiId || !apiHash) {
    throw new Error('TG_CLIENT_API_ID and TG_CLIENT_API_HASH are required')
  }

  const stringSession = new StringSession(session || '')
  transport = new GramJsTransport(apiId, apiHash, stringSession, logger.child({ component: 'gramjs' }))

  await transport.connect()
  return transport
}

export function getCircuitBreaker(): CircuitBreaker {
  if (!circuitBreaker) {
    if (!transport) {
      throw new Error('Transport must be initialized before CircuitBreaker')
    }
    circuitBreaker = new CircuitBreaker(
      transport,
      {
        failureThreshold: 5,
        resetTimeoutMs: 30_000,
        windowMs: 60_000,
      },
      logger.child({ component: 'circuit-breaker' }),
    )
  }
  return circuitBreaker
}

export async function getActionRunner(): Promise<ActionRunner> {
  if (!actionRunner) {
    await getTelegramTransport()
    const cb = getCircuitBreaker()
    actionRunner = new ActionRunner(
      cb,
      logger.child({ component: 'action-runner' }),
      {
        maxRetries: 3,
        backoffBaseMs: 1000,
        backoffMaxMs: 60_000,
      },
    )
  }
  return actionRunner
}

export function getTelegramLogger() {
  return logger
}
