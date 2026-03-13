import type { Client } from 'discord.js'
import type { Config } from '../config.js'
import process from 'node:process'
import {
  ChannelType,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from 'discord.js'
import { Hono } from 'hono'

const startedAt = Date.now()

export function createServer(client: Client, config: Config): Hono {
  const app = new Hono()

  // --- Health check ---
  app.get('/health', (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const memUsage = process.memoryUsage()

    return c.json({
      status: 'ok',
      uptime,
      bot: {
        ready: client.isReady(),
        username: client.user?.tag ?? null,
        guilds: client.guilds.cache.size,
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    })
  })

  // --- Execute Discord action (used by flow dispatcher) ---
  app.post('/api/execute-action', async (c) => {
    try {
      const body = await c.req.json<{ action: string; params: Record<string, unknown> }>()
      if (!body.action) {
        return c.json({ success: false, error: 'action is required' }, 400)
      }

      const { action, params } = body
      let result: unknown

      switch (action) {
        // --- Messaging ---
        case 'discord_send_message': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msg = await channel.send(String(params.content ?? ''))
          result = { messageId: msg.id }
          break
        }

        case 'discord_send_embed': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const embedData = params.embed as Record<string, unknown> ?? {}
          const embed = new EmbedBuilder()
          if (embedData.title) embed.setTitle(String(embedData.title))
          if (embedData.description) embed.setDescription(String(embedData.description))
          if (embedData.color) embed.setColor(Number(embedData.color))
          if (embedData.url) embed.setURL(String(embedData.url))
          if (embedData.thumbnail) embed.setThumbnail(String(embedData.thumbnail))
          if (embedData.image) embed.setImage(String(embedData.image))
          if (embedData.footer) embed.setFooter({ text: String(embedData.footer) })

          const msg = await channel.send({
            content: params.content ? String(params.content) : undefined,
            embeds: [embed],
          })
          result = { messageId: msg.id }
          break
        }

        case 'discord_send_dm': {
          const user = await client.users.fetch(String(params.userId))
          const msg = await user.send(String(params.content ?? ''))
          result = { messageId: msg.id }
          break
        }

        case 'discord_edit_message': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgToEdit = await channel.messages.fetch(String(params.messageId))
          await msgToEdit.edit(String(params.content ?? ''))
          result = { edited: true }
          break
        }

        case 'discord_delete_message': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgToDelete = await channel.messages.fetch(String(params.messageId))
          await msgToDelete.delete()
          result = { deleted: true }
          break
        }

        // --- Reactions ---
        case 'discord_add_reaction': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgForReact = await channel.messages.fetch(String(params.messageId))
          await msgForReact.react(String(params.emoji))
          result = { reacted: true }
          break
        }

        case 'discord_remove_reaction': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgForUnreact = await channel.messages.fetch(String(params.messageId))
          const userId = params.userId ? String(params.userId) : client.user?.id
          if (userId) {
            await msgForUnreact.reactions.resolve(String(params.emoji))?.users.remove(userId)
          }
          result = { removed: true }
          break
        }

        // --- Pin/Unpin ---
        case 'discord_pin_message': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgToPin = await channel.messages.fetch(String(params.messageId))
          await msgToPin.pin()
          result = { pinned: true }
          break
        }

        case 'discord_unpin_message': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased()) {
            return c.json({ success: false, error: 'Invalid or non-text channel' }, 400)
          }
          const msgToUnpin = await channel.messages.fetch(String(params.messageId))
          await msgToUnpin.unpin()
          result = { unpinned: true }
          break
        }

        // --- Member management ---
        case 'discord_ban_member': {
          const guild = await client.guilds.fetch(String(params.guildId))
          await guild.members.ban(String(params.userId), {
            reason: params.reason ? String(params.reason) : undefined,
            deleteMessageSeconds: params.deleteMessageDays
              ? Number(params.deleteMessageDays) * 86400
              : undefined,
          })
          result = { banned: true }
          break
        }

        case 'discord_kick_member': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const memberToKick = await guild.members.fetch(String(params.userId))
          await memberToKick.kick(params.reason ? String(params.reason) : undefined)
          result = { kicked: true }
          break
        }

        case 'discord_timeout_member': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const memberToTimeout = await guild.members.fetch(String(params.userId))
          const durationMs = params.duration ? Number(params.duration) * 1000 : 60_000
          await memberToTimeout.timeout(durationMs, params.reason ? String(params.reason) : undefined)
          result = { timedOut: true }
          break
        }

        // --- Role management ---
        case 'discord_add_role': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const member = await guild.members.fetch(String(params.userId))
          await member.roles.add(String(params.roleId), params.reason ? String(params.reason) : undefined)
          result = { roleAdded: true }
          break
        }

        case 'discord_remove_role': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const memberForRole = await guild.members.fetch(String(params.userId))
          await memberForRole.roles.remove(String(params.roleId), params.reason ? String(params.reason) : undefined)
          result = { roleRemoved: true }
          break
        }

        case 'discord_create_role': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const role = await guild.roles.create({
            name: String(params.name ?? 'New Role'),
            color: params.color ? Number(params.color) : undefined,
            hoist: params.hoist ? Boolean(params.hoist) : false,
            mentionable: params.mentionable ? Boolean(params.mentionable) : false,
            reason: params.reason ? String(params.reason) : undefined,
          })
          result = { roleId: role.id, roleName: role.name }
          break
        }

        case 'discord_set_nickname': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const memberForNick = await guild.members.fetch(String(params.userId))
          await memberForNick.setNickname(
            params.nickname ? String(params.nickname) : null,
            params.reason ? String(params.reason) : undefined,
          )
          result = { nicknameSet: true }
          break
        }

        // --- Channel management ---
        case 'discord_create_channel': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const channelTypeMap = {
            text: ChannelType.GuildText,
            voice: ChannelType.GuildVoice,
            category: ChannelType.GuildCategory,
            announcement: ChannelType.GuildAnnouncement,
            stage: ChannelType.GuildStageVoice,
            forum: ChannelType.GuildForum,
          } as const
          type GuildChannelType = typeof channelTypeMap[keyof typeof channelTypeMap]
          const typeKey = String(params.type ?? 'text') as keyof typeof channelTypeMap
          const chType: GuildChannelType = channelTypeMap[typeKey] ?? ChannelType.GuildText
          const newChannel = await guild.channels.create({
            name: String(params.name ?? 'new-channel'),
            type: chType,
            parent: params.parentId ? String(params.parentId) : undefined,
            topic: params.topic ? String(params.topic) : undefined,
            reason: params.reason ? String(params.reason) : undefined,
          })
          result = { channelId: newChannel.id, channelName: newChannel.name }
          break
        }

        case 'discord_delete_channel': {
          const channelToDelete = await client.channels.fetch(String(params.channelId))
          if (channelToDelete && 'delete' in channelToDelete) {
            await channelToDelete.delete(params.reason ? String(params.reason) : undefined)
          }
          result = { deleted: true }
          break
        }

        case 'discord_move_member': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const memberToMove = await guild.members.fetch(String(params.userId))
          await memberToMove.voice.setChannel(
            params.channelId ? String(params.channelId) : null,
            params.reason ? String(params.reason) : undefined,
          )
          result = { moved: true }
          break
        }

        // --- Thread management ---
        case 'discord_create_thread': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel?.isTextBased() || channel.isDMBased() || !('threads' in channel)) {
            return c.json({ success: false, error: 'Channel does not support threads' }, 400)
          }
          const thread = await channel.threads.create({
            name: String(params.name ?? 'New Thread'),
            autoArchiveDuration: params.autoArchiveDuration ? Number(params.autoArchiveDuration) as 60 | 1440 | 4320 | 10080 : undefined,
            reason: params.reason ? String(params.reason) : undefined,
          })
          result = { threadId: thread.id, threadName: thread.name }
          break
        }

        case 'discord_send_thread_message': {
          const thread = await client.channels.fetch(String(params.threadId))
          if (!thread?.isTextBased() || !('send' in thread)) {
            return c.json({ success: false, error: 'Invalid thread channel' }, 400)
          }
          const threadMsg = await (thread as Extract<typeof thread, { send: unknown }>).send(String(params.content ?? ''))
          result = { messageId: threadMsg.id }
          break
        }

        // --- Invite ---
        case 'discord_create_invite': {
          const channel = await client.channels.fetch(String(params.channelId))
          if (!channel || !('createInvite' in channel)) {
            return c.json({ success: false, error: 'Channel does not support invites' }, 400)
          }
          const invite = await channel.createInvite({
            maxAge: params.maxAge ? Number(params.maxAge) : 86400,
            maxUses: params.maxUses ? Number(params.maxUses) : 0,
            unique: params.unique ? Boolean(params.unique) : true,
            reason: params.reason ? String(params.reason) : undefined,
          })
          result = { inviteCode: invite.code, inviteUrl: invite.url }
          break
        }

        // --- Scheduled Events ---
        case 'discord_create_scheduled_event': {
          const guild = await client.guilds.fetch(String(params.guildId))
          const event = await guild.scheduledEvents.create({
            name: String(params.name ?? 'New Event'),
            scheduledStartTime: new Date(String(params.startTime)),
            scheduledEndTime: params.endTime ? new Date(String(params.endTime)) : undefined,
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            entityType: params.channelId
              ? GuildScheduledEventEntityType.Voice
              : GuildScheduledEventEntityType.External,
            channel: params.channelId ? String(params.channelId) : undefined,
            entityMetadata: !params.channelId && params.location
              ? { location: String(params.location) }
              : undefined,
            description: params.description ? String(params.description) : undefined,
            reason: params.reason ? String(params.reason) : undefined,
          })
          result = { eventId: event.id, eventName: event.name }
          break
        }

        default:
          return c.json({ success: false, error: `Unknown action: ${action}` }, 400)
      }

      return c.json({ success: true, result })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[discord-bot] Failed to execute action:', error)
      return c.json({ success: false, error: message }, 500)
    }
  })

  // --- Forward Discord events to flow engine ---
  app.post('/api/flow-event', async (c) => {
    try {
      const body = await c.req.json<{ eventType: string; data: unknown }>()
      if (!body.eventType) {
        return c.json({ success: false, error: 'eventType is required' }, 400)
      }

      const targetUrl = `${config.apiUrl}/api/flow/webhook`
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: body.eventType,
          platform: 'discord',
          data: body.data,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        console.error(`[discord-bot] Flow webhook forwarding failed: ${response.status}`, text)
        return c.json({ success: false, error: `API responded with ${response.status}` }, 502)
      }

      const responseData = await response.json()
      return c.json({ success: true, result: responseData })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[discord-bot] Failed to forward flow event:', error)
      return c.json({ success: false, error: message }, 500)
    }
  })

  app.onError((error, c) => {
    console.error('[discord-bot] Server error:', error, 'path:', c.req.path)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
