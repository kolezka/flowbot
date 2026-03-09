import type { Logger } from '../../logger.js'
import type { ITelegramTransport, MessageResult } from '../../transport/ITelegramTransport.js'
import type { BroadcastPayload } from '../types.js'

import * as v from 'valibot'

import { sleep } from '../../errors/backoff.js'
import { BroadcastPayloadSchema } from '../types.js'

const DEFAULT_DELAY_MS = 200

export interface BroadcastResult {
  results: Array<{ chatId: string, success: boolean, messageId?: number, error?: string }>
}

export async function executeBroadcast(
  transport: ITelegramTransport,
  payload: BroadcastPayload,
  logger: Logger,
): Promise<BroadcastResult> {
  const validated = v.parse(BroadcastPayloadSchema, payload)
  const delayMs = validated.delayMs ?? DEFAULT_DELAY_MS

  logger.info({ targetCount: validated.targetChatIds.length, delayMs }, 'Starting broadcast')

  const results: BroadcastResult['results'] = []

  for (let i = 0; i < validated.targetChatIds.length; i++) {
    const chatId = validated.targetChatIds[i]!

    if (i > 0) {
      await sleep(delayMs)
    }

    try {
      const result: MessageResult = await transport.sendMessage(chatId, validated.text, {
        parseMode: validated.parseMode as 'html' | 'markdown' | undefined,
      })

      logger.info({ chatId, messageId: result.id }, 'Broadcast delivered')
      results.push({ chatId, success: true, messageId: result.id })
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn({ chatId, error: errorMsg }, 'Broadcast delivery failed')
      results.push({ chatId, success: false, error: errorMsg })
    }
  }

  const successCount = results.filter(r => r.success).length
  logger.info(
    { total: results.length, success: successCount, failed: results.length - successCount },
    'Broadcast completed',
  )

  return { results }
}
