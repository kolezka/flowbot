import type { Logger } from '../logger.js'
import type { ITelegramTransport } from '../transport/ITelegramTransport.js'
import type { Action, CrossPostPayload, ForwardMessagePayload, SendMessagePayload, SendWelcomeDmPayload } from './types.js'

import { FloodWaitError } from 'telegram/errors'

import { calculateBackoff, sleep } from '../errors/backoff.js'
import { classifyError, ErrorCategory } from '../errors/classifier.js'
import { executeCrossPost } from './cross-post.js'
import { executeForwardMessage } from './forward-message.js'
import { executeSendMessage } from './send-message.js'
import { executeSendWelcomeDm } from './send-welcome-dm.js'
import { ActionType } from './types.js'

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
  attempts: number
}

export class ActionRunner {
  private readonly idempotencyMap = new Map<string, ActionResult>()
  private readonly transport: ITelegramTransport
  private readonly logger: Logger
  private readonly maxRetries: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number

  constructor(
    transport: ITelegramTransport,
    logger: Logger,
    config: { maxRetries: number, backoffBaseMs: number, backoffMaxMs: number },
  ) {
    this.transport = transport
    this.logger = logger
    this.maxRetries = config.maxRetries
    this.backoffBaseMs = config.backoffBaseMs
    this.backoffMaxMs = config.backoffMaxMs
  }

  async execute(action: Action): Promise<ActionResult> {
    if (action.idempotencyKey) {
      const cached = this.idempotencyMap.get(action.idempotencyKey)
      if (cached) {
        this.logger.info(
          { idempotencyKey: action.idempotencyKey, type: action.type },
          'Returning cached result for idempotent action',
        )
        return cached
      }
    }

    let lastError: unknown
    let attempts = 0

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      attempts = attempt + 1

      try {
        this.logger.info(
          { type: action.type, attempt: attempts, idempotencyKey: action.idempotencyKey },
          'Executing action',
        )

        const data = await this.dispatch(action)

        const result: ActionResult = { success: true, data, attempts }

        this.logger.info(
          { type: action.type, attempts, idempotencyKey: action.idempotencyKey },
          'Action executed successfully',
        )

        if (action.idempotencyKey) {
          this.idempotencyMap.set(action.idempotencyKey, result)
        }

        return result
      }
      catch (error) {
        lastError = error
        const category = classifyError(error)

        this.logger.warn(
          {
            type: action.type,
            attempt: attempts,
            category,
            error: error instanceof Error ? error.message : String(error),
            idempotencyKey: action.idempotencyKey,
          },
          'Action execution failed',
        )

        if (category === ErrorCategory.AUTH_EXPIRED) {
          throw error
        }

        if (category === ErrorCategory.FATAL) {
          throw error
        }

        if (attempt >= this.maxRetries) {
          break
        }

        if (category === ErrorCategory.RATE_LIMITED) {
          const waitMs = error instanceof FloodWaitError && error.seconds > 0
            ? error.seconds * 1000
            : calculateBackoff(attempt, this.backoffBaseMs, this.backoffMaxMs)

          this.logger.info(
            { waitMs, attempt: attempts, type: action.type },
            'Rate limited, waiting before retry',
          )

          await sleep(waitMs)
        }
        else {
          const backoffMs = calculateBackoff(attempt, this.backoffBaseMs, this.backoffMaxMs)

          this.logger.info(
            { backoffMs, attempt: attempts, type: action.type },
            'Retryable error, backing off before retry',
          )

          await sleep(backoffMs)
        }
      }
    }

    const result: ActionResult = {
      success: false,
      error: lastError instanceof Error ? lastError.message : String(lastError),
      attempts,
    }

    this.logger.error(
      { type: action.type, attempts, idempotencyKey: action.idempotencyKey, error: result.error },
      'Action failed after all retry attempts',
    )

    if (action.idempotencyKey) {
      this.idempotencyMap.set(action.idempotencyKey, result)
    }

    return result
  }

  private async dispatch(action: Action): Promise<unknown> {
    switch (action.type) {
      case ActionType.SEND_MESSAGE:
        return executeSendMessage(
          this.transport,
          action.payload as SendMessagePayload,
          this.logger,
        )
      case ActionType.FORWARD_MESSAGE:
        return executeForwardMessage(
          this.transport,
          action.payload as ForwardMessagePayload,
          this.logger,
        )
      case ActionType.SEND_WELCOME_DM:
        return executeSendWelcomeDm(
          this.transport,
          action.payload as SendWelcomeDmPayload,
          this.logger,
        )
      case ActionType.CROSS_POST:
        return executeCrossPost(
          this.transport,
          action.payload as CrossPostPayload,
          this.logger,
        )
      default:
        throw new Error(`Unknown action type: ${String((action as Action).type)}`)
    }
  }
}
