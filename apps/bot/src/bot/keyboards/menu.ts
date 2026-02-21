import { menuData } from '../callback-data/menu'
import { InlineKeyboard } from 'grammy'

export function createMainMenuKeyboard() {
  return InlineKeyboard.from([
    [
      { text: '🛍️ Products', callback_data: menuData.pack({ section: 'products' }) },
    ],
    [
      { text: '🛒 Cart', callback_data: menuData.pack({ section: 'cart' }) },
    ],
    [
      { text: '🌐 Language', callback_data: menuData.pack({ section: 'language' }) },
    ],
    [
      { text: '👤 Profile', callback_data: menuData.pack({ section: 'profile' }) },
    ],
  ])
}

export function createBackToMenuKeyboard() {
  return InlineKeyboard.from([
    [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
  ])
}
