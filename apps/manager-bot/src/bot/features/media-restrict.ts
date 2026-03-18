import type { PrismaClient } from '@flowbot/db'
import type { ChatPermissions } from 'grammy/types'
import type { Context } from '../context.js'
import { Composer } from 'grammy'
import { ModerationLogRepository } from '../../repositories/ModerationLogRepository.js'
import { logHandle } from '../helpers/logging.js'
import { requirePermission } from '../helpers/permissions.js'

type MediaType = keyof typeof MEDIA_TYPES

const MEDIA_TYPES = {
  photo: { permission: 'can_send_photos' as const, label: 'Photos' },
  video: { permission: 'can_send_videos' as const, label: 'Videos' },
  audio: { permission: 'can_send_audios' as const, label: 'Audio' },
  voice: { permission: 'can_send_voice_notes' as const, label: 'Voice notes' },
  videonote: { permission: 'can_send_video_notes' as const, label: 'Video notes' },
  sticker: { permission: 'can_send_other_messages' as const, label: 'Stickers/GIFs' },
  document: { permission: 'can_send_documents' as const, label: 'Documents' },
  poll: { permission: 'can_send_polls' as const, label: 'Polls' },
  media: { permission: 'can_send_photos' as const, label: 'All media' },
} as const

// "media" maps to multiple permissions
const ALL_MEDIA_PERMISSIONS: (keyof ChatPermissions)[] = [
  'can_send_photos',
  'can_send_videos',
  'can_send_audios',
  'can_send_voice_notes',
  'can_send_video_notes',
  'can_send_other_messages',
  'can_send_documents',
]

export function createMediaRestrictFeature(prisma: PrismaClient) {
  const feature = new Composer<Context>()
  const modLogRepo = new ModerationLogRepository(prisma)

  // /restrict <type> on|off
  feature.command('restrict', requirePermission('admin', prisma), logHandle('cmd:restrict'), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/) ?? []

    if (args.length < 2 || !args[0] || !args[1]) {
      const types = Object.entries(MEDIA_TYPES).map(([k, v]) => `<code>${k}</code> — ${v.label}`).join('\n')
      await ctx.reply(`Usage: /restrict &lt;type&gt; on|off\n\n<b>Media types:</b>\n${types}\n\nExample: /restrict photo off`)
      return
    }

    const mediaType = args[0].toLowerCase()
    const action = args[1].toLowerCase()

    if (!(mediaType in MEDIA_TYPES)) {
      const types = Object.keys(MEDIA_TYPES).join(', ')
      await ctx.reply(`Unknown media type: <code>${mediaType}</code>\n\nAvailable: ${types}`)
      return
    }

    if (action !== 'on' && action !== 'off') {
      await ctx.reply('Usage: /restrict &lt;type&gt; <b>on</b>|<b>off</b>\n\n<code>on</code> = allow, <code>off</code> = block')
      return
    }

    const allowed = action === 'on'
    const typeDef = MEDIA_TYPES[mediaType as MediaType]

    // Get current chat permissions
    const chat = await ctx.api.getChat(ctx.chat.id)
    const current: ChatPermissions = 'permissions' in chat && chat.permissions ? { ...chat.permissions } : {}

    // Build new permissions
    const updated: ChatPermissions = { ...current }

    if (mediaType === 'media') {
      for (const perm of ALL_MEDIA_PERMISSIONS) {
        updated[perm] = allowed
      }
    }
    else {
      updated[typeDef.permission] = allowed
    }

    await ctx.setChatPermissions(updated)

    const group = await prisma.managedGroup.findUnique({ where: { chatId: BigInt(ctx.chat.id) } })
    if (group) {
      await modLogRepo.create({
        groupId: group.id,
        action: 'media_restrict',
        actorId: BigInt(ctx.from!.id),
        details: { mediaType, allowed },
      })
    }

    const statusEmoji = allowed ? '✅' : '🚫'
    await ctx.reply(`${statusEmoji} <b>${typeDef.label}</b> ${allowed ? 'allowed' : 'blocked'} for members.`)
  })

  // /mediapermissions — show current media permissions
  feature.command('mediapermissions', requirePermission('admin', prisma), logHandle('cmd:mediapermissions'), async (ctx) => {
    const chat = await ctx.api.getChat(ctx.chat.id)
    const perms: ChatPermissions = 'permissions' in chat && chat.permissions ? chat.permissions : {}

    const lines = Object.entries(MEDIA_TYPES)
      .filter(([k]) => k !== 'media')
      .map(([, v]) => {
        const allowed = perms[v.permission] ?? true
        return `• <b>${v.label}</b>: ${allowed ? '✅ Allowed' : '🚫 Blocked'}`
      })

    await ctx.reply(`📷 <b>Media Permissions</b>\n\n${lines.join('\n')}\n\nUse /restrict &lt;type&gt; on|off to change.`)
  })

  return feature
}
