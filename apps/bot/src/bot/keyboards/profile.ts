import { menuData } from '../callback-data/menu'
import { InlineKeyboard } from 'grammy'

export function createProfileKeyboard() {
  return InlineKeyboard.from([
    [{ text: '🔙 Back to Menu', callback_data: menuData.pack({ section: 'menu' }) }],
  ])
}
