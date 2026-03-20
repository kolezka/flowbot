import type { Context } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

/**
 * /start command handler — sends a welcome message with a main menu prompt.
 * Responds only in private chats (DMs) to avoid cluttering group chats.
 */
composer.chatType('private').command('start', async (ctx) => {
  await ctx.reply(
    '<b>Welcome!</b>\n\nI\'m your Flowbot assistant. Use /help to see available commands.',
    { parse_mode: 'HTML' },
  )
})

export { composer as welcomeFeature }
