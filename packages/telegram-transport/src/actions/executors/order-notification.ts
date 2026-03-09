import type { Logger } from '../../logger.js'
import type { ITelegramTransport, MessageResult } from '../../transport/ITelegramTransport.js'
import type { SendOrderNotificationPayload } from '../types.js'

import * as v from 'valibot'

import { sleep } from '../../errors/backoff.js'
import { SendOrderNotificationPayloadSchema } from '../types.js'

const STAGGER_DELAY_MS = 100

export interface OrderNotificationResult {
  results: Array<{ chatId: string, success: boolean, messageId?: number, error?: string }>
}

function anonymizeBuyer(orderData: Record<string, unknown>): Record<string, unknown> {
  const anonymized = { ...orderData }

  // Remove or mask buyer-identifiable fields
  if (anonymized.buyerName && typeof anonymized.buyerName === 'string') {
    const name = anonymized.buyerName
    anonymized.buyerName = name.charAt(0) + '***'
  }
  delete anonymized.buyerEmail
  delete anonymized.buyerPhone
  delete anonymized.buyerAddress
  delete anonymized.shippingAddress
  delete anonymized.billingAddress
  delete anonymized.buyerId
  delete anonymized.telegramId

  return anonymized
}

function formatOrderMessage(eventType: string, orderData: Record<string, unknown>): string {
  const anonymized = anonymizeBuyer(orderData)

  const productName = anonymized.productName ?? anonymized.itemName ?? 'an item'
  const quantity = anonymized.quantity ?? 1
  const city = anonymized.city ?? anonymized.buyerCity

  let message = ''

  switch (eventType) {
    case 'order_placed':
      message = `<b>New Order!</b>\n`
        + `Someone just ordered <b>${String(productName)}</b>`
        + (Number(quantity) > 1 ? ` (x${String(quantity)})` : '')
        + (city ? ` from ${String(city)}` : '')
        + `\n\nJoin the trend!`
      break
    case 'order_shipped':
      message = `<b>Order Shipped!</b>\n`
        + `An order of <b>${String(productName)}</b> is on its way!`
        + (city ? ` Heading to ${String(city)}` : '')
      break
    default:
      message = `<b>Order Update</b>\n`
        + `Activity on <b>${String(productName)}</b>`
  }

  return message
}

export async function executeOrderNotification(
  transport: ITelegramTransport,
  payload: SendOrderNotificationPayload,
  logger: Logger,
): Promise<OrderNotificationResult> {
  const validated = v.parse(SendOrderNotificationPayloadSchema, payload)

  logger.info(
    { eventType: validated.eventType, targetCount: validated.targetChatIds.length },
    'Starting order notification',
  )

  const message = formatOrderMessage(validated.eventType, validated.orderData)
  const results: OrderNotificationResult['results'] = []

  for (let i = 0; i < validated.targetChatIds.length; i++) {
    const chatId = validated.targetChatIds[i]!

    if (i > 0) {
      await sleep(STAGGER_DELAY_MS)
    }

    try {
      const result: MessageResult = await transport.sendMessage(chatId, message, {
        parseMode: validated.parseMode as 'html' | 'markdown' | undefined ?? 'html',
      })

      logger.info({ chatId, messageId: result.id }, 'Order notification delivered')
      results.push({ chatId, success: true, messageId: result.id })
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn({ chatId, error: errorMsg }, 'Order notification delivery failed')
      results.push({ chatId, success: false, error: errorMsg })
    }
  }

  const successCount = results.filter(r => r.success).length
  logger.info(
    { total: results.length, success: successCount, failed: results.length - successCount },
    'Order notification completed',
  )

  return { results }
}
