import { menuData } from '../callback-data/menu.js'
import { InlineKeyboard } from 'grammy'

export function createProfileKeyboard() {
  return InlineKeyboard.from([
    [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
  ])
}
