import type { Context } from 'grammy'
import { Composer } from 'grammy'

const composer = new Composer<Context>()

/**
 * /help command handler — lists available commands.
 */
composer.chatType('private').command('help', async (ctx) => {
  const helpText =
    '<b>Available Commands</b>\n\n' +
    '/start — Welcome message\n' +
    '/help — Show this help\n' +
    '/status — Check bot status'

  await ctx.reply(helpText, { parse_mode: 'HTML' })
})

/**
 * /status command handler — reports bot status.
 */
composer.command('status', async (ctx) => {
  await ctx.reply('Bot is running.', { parse_mode: 'HTML' })
})

export { composer as menuFeature }
