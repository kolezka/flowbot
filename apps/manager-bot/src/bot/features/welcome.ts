import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

const DEFAULT_WELCOME = 'Welcome to {group}, {user}!'

const TEMPLATE_VARS: Record<string, string> = {
  '{user}': 'New member\'s name (linked)',
  '{username}': 'New member\'s @username or name',
  '{group}': 'Group title',
  '{id}': 'User\'s Telegram ID',
  '{count}': 'Group member count',
}

function renderTemplate(template: string, vars: {
  firstName: string
  username?: string
  userId: number
  groupTitle: string
  memberCount?: number
}): string {
  const userLink = `<a href="tg://user?id=${vars.userId}">${escapeHtml(vars.firstName)}</a>`
  const usernameDisplay = vars.username ? `@${vars.username}` : vars.firstName

  return template
    .replace(/\{user\}/g, userLink)
    .replace(/\{username\}/g, escapeHtml(usernameDisplay))
    .replace(/\{group\}/g, escapeHtml(vars.groupTitle))
    .replace(/\{id\}/g, String(vars.userId))
    .replace(/\{count\}/g, String(vars.memberCount ?? ''))
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function createWelcomeFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  // Handle chat_member updates for new joins
  feature.on('chat_member', async (ctx, next) => {
    const update = ctx.chatMember
    if (!update)
      return next()

    const oldStatus = update.old_chat_member.status
    const newStatus = update.new_chat_member.status

    // Detect joins: was not member → became member/admin
    const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
    const isIn = newStatus === 'member' || newStatus === 'administrator' || newStatus === 'creator'

    if (!wasOut || !isIn)
      return next()

    const newMember = update.new_chat_member.user
    if (newMember.is_bot)
      return next()

    const config = ctx.session.groupConfig
    if (!config?.welcomeEnabled)
      return next()

    const template = config.welcomeMessage || DEFAULT_WELCOME

    let memberCount: number | undefined
    try {
      memberCount = await ctx.api.getChatMemberCount(ctx.chat.id)
    }
    catch { /* ignore */ }

    const message = renderTemplate(template, {
      firstName: newMember.first_name,
      username: newMember.username,
      userId: newMember.id,
      groupTitle: ctx.chat.title ?? 'this group',
      memberCount,
    })

    await ctx.api.sendMessage(ctx.chat.id, message, { parse_mode: 'HTML' })

    // Pipeline: emit log entry for Trigger.dev to pick up later
    if (config.pipelineEnabled) {
      const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
      if (group) {
        const dmTemplate = config.pipelineDmTemplate || 'Welcome! Check out our shop.'
        const deeplink = config.pipelineDeeplink || ''

        await modLogRepo.create({
          groupId: group.id,
          action: 'pipeline_trigger',
          actorId: BigInt(newMember.id),
          targetId: BigInt(newMember.id),
          automated: true,
          details: {
            userId: newMember.id,
            username: newMember.username,
            firstName: newMember.first_name,
            text: dmTemplate,
            deeplink,
          },
        })

        ctx.logger.info(
          { userId: newMember.id, groupId: group.id },
          'Pipeline trigger logged for new member',
        )
      }
    }
  })

  // Handle my_chat_member — bot added/removed from group
  feature.on('my_chat_member', async (ctx) => {
    const update = ctx.myChatMember
    if (!update)
      return

    const newStatus = update.new_chat_member.status
    const oldStatus = update.old_chat_member.status

    // Bot added to group
    const wasOut = oldStatus === 'left' || oldStatus === 'kicked'
    const isIn = newStatus === 'member' || newStatus === 'administrator'

    if (wasOut && isIn) {
      ctx.logger.info({ chatId: ctx.chat.id, title: ctx.chat.title }, 'Bot added to group')
      // Group data middleware will handle upsert
      return
    }

    // Bot removed from group
    const nowOut = newStatus === 'left' || newStatus === 'kicked'
    if (!wasOut && nowOut) {
      ctx.logger.info({ chatId: ctx.chat.id, title: ctx.chat.title }, 'Bot removed from group')

      // Deactivate group
      try {
        await prisma.managedGroup.updateMany({
          where: { chatId: BigInt(ctx.chat.id) },
          data: { isActive: false },
        })
      }
      catch { /* ignore */ }
    }
  })

  // /setwelcome <message> — set custom welcome message
  feature.command('setwelcome', requirePermission('admin', prisma), logHandle('cmd:setwelcome'), async (ctx) => {
    const text = ctx.match?.toString().trim()
    if (!text) {
      const vars = Object.entries(TEMPLATE_VARS).map(([k, v]) => `${k} — ${v}`).join('\n')
      await ctx.reply(`Usage: /setwelcome &lt;message&gt;\n\n<b>Available variables:</b>\n${vars}`)
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    await configRepo.updateConfig(config.groupId, { welcomeMessage: text })
    ctx.session.groupConfig = { ...config, welcomeMessage: text }

    await ctx.reply('✅ Welcome message updated.')
  })

  // /welcome on|off — toggle welcome messages
  feature.command('welcome', requirePermission('admin', prisma), logHandle('cmd:welcome'), async (ctx) => {
    const arg = ctx.match?.toString().trim().toLowerCase()

    const config = ctx.session.groupConfig
    if (!config)
      return

    if (arg === 'on') {
      await configRepo.updateConfig(config.groupId, { welcomeEnabled: true })
      ctx.session.groupConfig = { ...config, welcomeEnabled: true }
      await ctx.reply('✅ Welcome messages enabled.')
    }
    else if (arg === 'off') {
      await configRepo.updateConfig(config.groupId, { welcomeEnabled: false })
      ctx.session.groupConfig = { ...config, welcomeEnabled: false }
      await ctx.reply('✅ Welcome messages disabled.')
    }
    else {
      const status = config.welcomeEnabled ? '✅ Enabled' : '❌ Disabled'
      const template = config.welcomeMessage || DEFAULT_WELCOME
      await ctx.reply(`<b>Welcome Messages</b>: ${status}\n\n<b>Template:</b>\n${escapeHtml(template)}`)
    }
  })

  // /testwelcome — preview welcome message
  feature.command('testwelcome', requirePermission('admin', prisma), logHandle('cmd:testwelcome'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config)
      return

    const template = config.welcomeMessage || DEFAULT_WELCOME

    let memberCount: number | undefined
    try {
      memberCount = await ctx.api.getChatMemberCount(ctx.chat.id)
    }
    catch { /* ignore */ }

    const message = renderTemplate(template, {
      firstName: ctx.from!.first_name,
      username: ctx.from!.username,
      userId: ctx.from!.id,
      groupTitle: ctx.chat.title ?? 'this group',
      memberCount,
    })

    await ctx.reply(`<b>Welcome preview:</b>\n\n${message}`)
  })

  return feature
}
