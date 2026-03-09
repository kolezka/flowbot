import type { PrismaClient } from '@tg-allegro/db'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { GroupConfigRepository } from '../../repositories/GroupConfigRepository.js'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

interface ConfigField {
  key: string
  label: string
  type: 'boolean' | 'int' | 'string'
}

const CONFIGURABLE_FIELDS: ConfigField[] = [
  { key: 'welcomeEnabled', label: 'Welcome messages', type: 'boolean' },
  { key: 'antiSpamEnabled', label: 'Anti-spam', type: 'boolean' },
  { key: 'antiSpamMaxMessages', label: 'Anti-spam max messages', type: 'int' },
  { key: 'antiSpamWindowSeconds', label: 'Anti-spam window (seconds)', type: 'int' },
  { key: 'antiLinkEnabled', label: 'Anti-link', type: 'boolean' },
  { key: 'warnThresholdMute', label: 'Warn threshold → mute', type: 'int' },
  { key: 'warnThresholdBan', label: 'Warn threshold → ban', type: 'int' },
  { key: 'warnDecayDays', label: 'Warning decay (days)', type: 'int' },
  { key: 'defaultMuteDurationS', label: 'Default mute duration (seconds)', type: 'int' },
  { key: 'slowModeDelay', label: 'Slow mode delay (seconds)', type: 'int' },
  { key: 'autoDeleteCommandsS', label: 'Auto-delete commands (seconds)', type: 'int' },
  { key: 'captchaEnabled', label: 'CAPTCHA verification', type: 'boolean' },
  { key: 'captchaMode', label: 'CAPTCHA mode', type: 'string' },
  { key: 'captchaTimeoutS', label: 'CAPTCHA timeout (seconds)', type: 'int' },
  { key: 'quarantineEnabled', label: 'Quarantine new members', type: 'boolean' },
  { key: 'quarantineDurationS', label: 'Quarantine duration (seconds)', type: 'int' },
  { key: 'silentMode', label: 'Silent mode', type: 'boolean' },
]

function formatValue(value: unknown): string {
  if (typeof value === 'boolean')
    return value ? '✅ On' : '❌ Off'
  return String(value)
}

function parseValue(type: 'boolean' | 'int' | 'string', raw: string): boolean | number | string | null {
  if (type === 'boolean') {
    const lower = raw.toLowerCase()
    if (lower === 'on' || lower === 'true' || lower === '1')
      return true
    if (lower === 'off' || lower === 'false' || lower === '0')
      return false
    return null
  }
  if (type === 'int') {
    const num = Number.parseInt(raw, 10)
    if (Number.isNaN(num) || num < 0)
      return null
    return num
  }
  return raw
}

export function createSetupFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const configRepo = new GroupConfigRepository(prisma)
  const modLogRepo = new ModerationLogRepository(prisma)

  // /settings — display current group configuration
  feature.command('settings', requirePermission('admin', prisma), logHandle('cmd:settings'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config) {
      await ctx.reply('No configuration found for this group.')
      return
    }

    const lines = CONFIGURABLE_FIELDS.map((field) => {
      const value = (config as Record<string, unknown>)[field.key]
      return `• <b>${field.label}</b>: ${formatValue(value)}`
    })

    await ctx.reply(`⚙️ <b>Group Settings</b>\n\n${lines.join('\n')}\n\nUse /config &lt;key&gt; &lt;value&gt; to change.`)
  })

  // /config key value — change a setting
  feature.command('config', requirePermission('admin', prisma), logHandle('cmd:config'), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/) ?? []

    if (args.length < 2 || !args[0]) {
      const keys = CONFIGURABLE_FIELDS.map(f => `<code>${f.key}</code>`).join(', ')
      await ctx.reply(`Usage: /config &lt;key&gt; &lt;value&gt;\n\n<b>Available keys:</b>\n${keys}`)
      return
    }

    const key = args[0]
    const rawValue = args.slice(1).join(' ')

    const field = CONFIGURABLE_FIELDS.find(f => f.key === key)
    if (!field) {
      await ctx.reply(`Unknown config key: <code>${key}</code>\n\nUse /settings to see available keys.`)
      return
    }

    const parsed = parseValue(field.type, rawValue)
    if (parsed === null) {
      const expected = field.type === 'boolean' ? 'on/off' : field.type === 'int' ? 'a positive number' : 'text'
      await ctx.reply(`Invalid value for <b>${field.label}</b>. Expected ${expected}.`)
      return
    }

    const config = ctx.session.groupConfig
    if (!config)
      return

    await configRepo.updateConfig(config.groupId, { [key]: parsed })
    ctx.session.groupConfig = { ...config, [key]: parsed }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'config_change',
        actorId: BigInt(ctx.from!.id),
        details: { key, oldValue: String((config as Record<string, unknown>)[key]), newValue: String(parsed) },
      })
    }

    await ctx.reply(`✅ <b>${field.label}</b> set to ${formatValue(parsed)}.`)
  })

  // /setlogchannel — set or clear the moderation log channel
  feature.command('setlogchannel', requirePermission('admin', prisma), logHandle('cmd:setlogchannel'), async (ctx) => {
    const config = ctx.session.groupConfig
    if (!config)
      return

    const arg = ctx.match?.toString().trim()

    // /setlogchannel off — clear log channel
    if (arg === 'off' || arg === 'none') {
      await configRepo.updateConfig(config.groupId, { logChannelId: null })
      ctx.session.groupConfig = { ...config, logChannelId: null }
      await ctx.reply('✅ Log channel cleared. Moderation events will not be forwarded.')
      return
    }

    // /setlogchannel (no args) — use current chat as log channel
    const channelId = arg ? BigInt(arg) : BigInt(ctx.chat.id)

    await configRepo.updateConfig(config.groupId, { logChannelId: channelId })
    ctx.session.groupConfig = { ...config, logChannelId: channelId }

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'config_change',
        actorId: BigInt(ctx.from!.id),
        details: { key: 'logChannelId', newValue: channelId.toString() },
      })
    }

    await ctx.reply(`✅ Log channel set to <code>${channelId}</code>. Moderation events will be forwarded there.`)
  })

  return feature
}
