import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { isAdmin } from '../filters/is-admin.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

// Match URLs: http(s)://, www., or bare domain patterns
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|me|co|xyz|info|biz|ru|uk|de|fr|app|link|click|top|site|online|shop|store|tech|pro|world)\b(?:\/[^\s<>"{}|\\^`[\]]*)*/gi

function extractDomain(url: string): string {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase()
  }
  catch {
    // Fallback: extract domain-like portion
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^/\s]+)/i)
    return match?.[1]?.toLowerCase() ?? url.toLowerCase()
  }
}

function containsBlockedLink(text: string, whitelist: string[]): boolean {
  const urls = text.match(URL_REGEX)
  if (!urls)
    return false

  const normalizedWhitelist = whitelist.map(d => d.replace(/^www\./, '').toLowerCase())

  return urls.some((url) => {
    const domain = extractDomain(url)
    return !normalizedWhitelist.some(w => domain === w || domain.endsWith(`.${w}`))
  })
}

export function createAntiLinkFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  // Link detection middleware — runs on text messages in groups
  feature.on(['message:text', 'message:caption'], async (ctx, next) => {
    const chatType = ctx.chat?.type
    if (chatType !== 'group' && chatType !== 'supergroup')
      return next()

    // Admins bypass
    if (isAdmin(ctx))
      return next()

    const config = ctx.session.groupConfig
    if (!config?.antiLinkEnabled)
      return next()

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : ctx.message?.caption
    if (!text)
      return next()

    if (!containsBlockedLink(text, config.antiLinkWhitelist))
      return next()

    // Link detected — delete message
    try {
      await ctx.deleteMessage()
    }
    catch { /* ignore if can't delete */ }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'link_blocked',
        actorId: BigInt(0),
        targetId: BigInt(ctx.from!.id),
        reason: 'Unauthorized link detected',
        automated: true,
      })
    }

    const msg = await ctx.reply('🔗 Links are not allowed in this group. Message removed.')

    // Auto-delete notice after 5s
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id)
      }
      catch { /* ignore */ }
    }, 5000)
  })

  // /allowlink <domain> — add domain to whitelist
  feature.command('allowlink', requirePermission('admin', prisma), logHandle('cmd:allowlink'), async (ctx) => {
    const domain = ctx.match?.toString().trim().toLowerCase()
    if (!domain) {
      await ctx.reply('Usage: /allowlink example.com')
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    const normalized = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').replace(/\/.*$/, '')
    const whitelist = [...config.antiLinkWhitelist]

    if (whitelist.includes(normalized)) {
      await ctx.reply(`✅ <b>${normalized}</b> is already whitelisted.`)
      return
    }

    whitelist.push(normalized)
    await configRepo.updateConfig(config.groupId, { antiLinkWhitelist: whitelist })
    ctx.session.groupConfig = { ...config, antiLinkWhitelist: whitelist }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'allowlink',
        actorId: BigInt(ctx.from!.id),
        details: { domain: normalized },
      })
    }

    await ctx.reply(`✅ <b>${normalized}</b> added to link whitelist.`)
  })

  // /denylink <domain> — remove domain from whitelist
  feature.command('denylink', requirePermission('admin', prisma), logHandle('cmd:denylink'), async (ctx) => {
    const domain = ctx.match?.toString().trim().toLowerCase()
    if (!domain) {
      await ctx.reply('Usage: /denylink example.com')
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    const normalized = domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').replace(/\/.*$/, '')
    const whitelist = config.antiLinkWhitelist.filter(d => d !== normalized)

    if (whitelist.length === config.antiLinkWhitelist.length) {
      await ctx.reply(`⚠️ <b>${normalized}</b> is not in the whitelist.`)
      return
    }

    await configRepo.updateConfig(config.groupId, { antiLinkWhitelist: whitelist })
    ctx.session.groupConfig = { ...config, antiLinkWhitelist: whitelist }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'denylink',
        actorId: BigInt(ctx.from!.id),
        details: { domain: normalized },
      })
    }

    await ctx.reply(`🚫 <b>${normalized}</b> removed from link whitelist.`)
  })

  // /links — show current whitelist
  feature.command('links', requirePermission('admin', prisma), logHandle('cmd:links'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config)
      return

    const enabled = config.antiLinkEnabled ? '✅ Enabled' : '❌ Disabled'

    if (config.antiLinkWhitelist.length === 0) {
      await ctx.reply(`🔗 <b>Anti-Link Protection</b>: ${enabled}\n\nNo whitelisted domains.`)
      return
    }

    const domains = config.antiLinkWhitelist.map(d => `• ${d}`).join('\n')
    await ctx.reply(`🔗 <b>Anti-Link Protection</b>: ${enabled}\n\n<b>Whitelisted domains:</b>\n${domains}`)
  })

  return feature
}
