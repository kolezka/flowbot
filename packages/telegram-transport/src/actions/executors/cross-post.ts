import type { Logger } from '../../logger.js'
import type { ITelegramTransport, MessageResult } from '../../transport/ITelegramTransport.js'
import type { CrossPostPayload } from '../types.js'

import * as v from 'valibot'

import { sleep } from '../../errors/backoff.js'
import { CrossPostPayloadSchema } from '../types.js'

const STAGGER_DELAY_MS = 100

export interface CrossPostResult {
  results: Array<{ chatId: string, success: boolean, messageId?: number, error?: string }>
}

export async function executeCrossPost(
  transport: ITelegramTransport,
  payload: CrossPostPayload,
  logger: Logger,
): Promise<CrossPostResult> {
  const validated = v.parse(CrossPostPayloadSchema, payload)

  logger.info({ targetCount: validated.targetChatIds.length }, 'Starting cross-post')

  const results: CrossPostResult['results'] = []

  for (let i = 0; i < validated.targetChatIds.length; i++) {
    const chatId = validated.targetChatIds[i]!

    if (i > 0) {
      await sleep(STAGGER_DELAY_MS)
    }

    try {
      const result: MessageResult = await transport.sendMessage(chatId, validated.text, {
        parseMode: validated.parseMode as 'html' | 'markdown' | undefined,
        silent: validated.silent,
      })

      logger.info({ chatId, messageId: result.id }, 'Cross-post delivered')
      results.push({ chatId, success: true, messageId: result.id })
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn({ chatId, error: errorMsg }, 'Cross-post delivery failed')
      results.push({ chatId, success: false, error: errorMsg })
    }
  }

  const successCount = results.filter(r => r.success).length
  logger.info(
    { total: results.length, success: successCount, failed: results.length - successCount },
    'Cross-post completed',
  )

  return { results }
}
