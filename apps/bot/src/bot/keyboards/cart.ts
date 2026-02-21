import type { Context } from '../context'
import { cartData } from '../callback-data/products'
import { chunk } from '../helpers/keyboard'
import { i18n } from '../i18n'
import { InlineKeyboard } from 'grammy'
import type { Cart, CartItem } from '@tg-allegro/db'

interface CartWithItems extends Cart {
  items?: CartItem[]
}

export function createCartKeyboard(cart: CartWithItems) {
  const keyboard = []

  if (cart.items && cart.items.length > 0) {
    // Add cart items with increment/decrement/remove buttons
    for (const item of cart.items) {
      const itemTotal = Number(item.productPrice) * item.quantity

      // First row: product name and quantity (non-interactive)
      keyboard.push([{
        text: `${item.productName} x${item.quantity} - $${itemTotal}`,
        callback_data: cartData.pack({
          action: 'noop',
          id: item.id,
        }),
      }])

      // Second row: quantity controls and remove button
      keyboard.push([
        {
          text: '➖',
          callback_data: cartData.pack({
            action: 'decrement',
            id: item.id,
          }),
        },
        {
          text: `${item.quantity}`,
          callback_data: cartData.pack({
            action: 'noop',
            id: item.id,
          }),
        },
        {
          text: '➕',
          callback_data: cartData.pack({
            action: 'increment',
            id: item.id,
          }),
        },
        {
          text: '🗑️',
          callback_data: cartData.pack({
            action: 'remove',
            id: item.id,
          }),
        },
      ])
    }
  }

  return InlineKeyboard.from(keyboard)
}

export function createCartActionsKeyboard() {
  const keyboard = [
    [
      {
        text: '🗑️ Clear Cart',
        callback_data: cartData.pack({
          action: 'clear',
          id: '',
        }),
      },
      {
        text: '✅ Checkout',
        callback_data: cartData.pack({
          action: 'view',
          id: '',
        }),
      },
    ],
    [
      {
        text: '🔙 Back to Products',
        callback_data: cartData.pack({
          action: 'back',
          id: '',
        }),
      },
    ],
  ]

  return InlineKeyboard.from(keyboard)
}
