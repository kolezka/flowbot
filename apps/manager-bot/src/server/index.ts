import type { PrismaClient } from '@flowbot/db'
import type { Api } from 'grammy'
import type { Bot } from '../bot/index.js'
import type { WebhookConfig } from '../config.js'
import type { Logger } from '../logger.js'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { webhookCallback } from 'grammy'
import { Hono } from 'hono'

interface ApiDependencies {
  botApi: Api
  logger: Logger
  prisma: PrismaClient
  apiUrl?: string
}

interface WebhookDependencies extends ApiDependencies {
  bot: Bot
  config: WebhookConfig
}

const startedAt = Date.now()

function addApiRoutes(server: Hono, { botApi, logger, prisma, apiUrl }: ApiDependencies) {
  server.get('/health', async (c) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)

    let dbStatus: 'ok' | 'error' = 'ok'
    let groupCount = 0
    try {
      groupCount = await prisma.managedGroup.count({ where: { isActive: true } })
    }
    catch {
      dbStatus = 'error'
    }

    const memUsage = process.memoryUsage()
    const status = dbStatus === 'ok' ? 'ok' : 'degraded'

    return c.json({
      status,
      uptime,
      database: dbStatus,
      groups: groupCount,
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
    }, status === 'ok' ? 200 : 503)
  })

  server.post('/api/send-message', async (c) => {
    try {
      const body = await c.req.json<{ chatId: string, text: string }>()
      if (!body.chatId || !body.text) {
        return c.json({ success: false, error: 'chatId and text are required' }, 400)
      }

      const msg = await botApi.sendMessage(body.chatId, body.text, { parse_mode: 'HTML' })
      return c.json({ success: true, messageId: msg.message_id })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Failed to send message via API')
      return c.json({ success: false, error: message }, 500)
    }
  })

  server.post('/api/flow-event', async (c) => {
    try {
      const body = await c.req.json<{ eventType: string, data: unknown }>()
      if (!body.eventType) {
        return c.json({ success: false, error: 'eventType is required' }, 400)
      }

      const targetUrl = `${apiUrl ?? 'http://localhost:3000'}/api/flow/webhook`
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: body.eventType, data: body.data }),
      })

      if (!response.ok) {
        const text = await response.text()
        logger.error({ status: response.status, body: text }, 'Flow webhook forwarding failed')
        return c.json({ success: false, error: `API responded with ${response.status}` }, 502)
      }

      const result = await response.json()
      return c.json({ success: true, result })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Failed to forward flow event')
      return c.json({ success: false, error: message }, 500)
    }
  })

  server.post('/api/execute-action', async (c) => {
    try {
      const body = await c.req.json<{ action: string; params: Record<string, unknown> }>()
      if (!body.action) {
        return c.json({ success: false, error: 'action is required' }, 400)
      }

      const { action, params } = body
      const chatId = String(params.chatId ?? '')
      const userId = params.userId ? Number(params.userId) : undefined

      let result: unknown

      switch (action) {
        // --- Messaging ---
        case 'send_message': {
          const msg = await botApi.sendMessage(chatId, String(params.text ?? ''), {
            parse_mode: String(params.parseMode ?? 'HTML') as 'HTML' | 'MarkdownV2',
            disable_notification: Boolean(params.disableNotification),
            reply_parameters: params.replyToMessageId ? { message_id: Number(params.replyToMessageId) } : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_photo': {
          const msg = await botApi.sendPhoto(chatId, String(params.photoUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
            parse_mode: params.parseMode ? String(params.parseMode) as 'HTML' | 'MarkdownV2' : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_video': {
          const msg = await botApi.sendVideo(chatId, String(params.videoUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
            parse_mode: params.parseMode ? String(params.parseMode) as 'HTML' | 'MarkdownV2' : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_document': {
          const msg = await botApi.sendDocument(chatId, String(params.documentUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
            parse_mode: params.parseMode ? String(params.parseMode) as 'HTML' | 'MarkdownV2' : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_sticker': {
          const msg = await botApi.sendSticker(chatId, String(params.sticker ?? ''))
          result = { messageId: msg.message_id }
          break
        }

        case 'send_voice': {
          const msg = await botApi.sendVoice(chatId, String(params.voiceUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_audio': {
          const msg = await botApi.sendAudio(chatId, String(params.audioUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
            parse_mode: params.parseMode ? String(params.parseMode) as 'HTML' | 'MarkdownV2' : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_animation': {
          const msg = await botApi.sendAnimation(chatId, String(params.animationUrl ?? ''), {
            caption: params.caption ? String(params.caption) : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_location': {
          const msg = await botApi.sendLocation(chatId, Number(params.latitude), Number(params.longitude))
          result = { messageId: msg.message_id }
          break
        }

        case 'send_contact': {
          const msg = await botApi.sendContact(chatId, String(params.phoneNumber ?? ''), String(params.firstName ?? ''), {
            last_name: params.lastName ? String(params.lastName) : undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'send_venue': {
          const msg = await botApi.sendVenue(chatId, Number(params.latitude), Number(params.longitude), String(params.title ?? ''), String(params.address ?? ''))
          result = { messageId: msg.message_id }
          break
        }

        case 'send_dice': {
          const emoji = params.emoji ? String(params.emoji) as any : '\u{1F3B2}'
          const msg = await botApi.sendDice(chatId, emoji)
          result = { messageId: msg.message_id }
          break
        }

        // --- Message management ---
        case 'forward_message': {
          const msg = await botApi.forwardMessage(String(params.toChatId ?? ''), String(params.fromChatId ?? ''), Number(params.messageId))
          result = { messageId: msg.message_id }
          break
        }

        case 'copy_message': {
          const msg = await botApi.copyMessage(String(params.toChatId ?? ''), String(params.fromChatId ?? ''), Number(params.messageId))
          result = { messageId: msg.message_id }
          break
        }

        case 'edit_message': {
          const msg = await botApi.editMessageText(chatId, Number(params.messageId), String(params.text ?? ''), {
            parse_mode: params.parseMode ? String(params.parseMode) as 'HTML' | 'MarkdownV2' : undefined,
          })
          result = { edited: true }
          break
        }

        case 'delete_message': {
          await botApi.deleteMessage(chatId, Number(params.messageId))
          result = { deleted: true }
          break
        }

        case 'pin_message': {
          await botApi.pinChatMessage(chatId, Number(params.messageId), {
            disable_notification: Boolean(params.disableNotification),
          })
          result = { pinned: true }
          break
        }

        case 'unpin_message': {
          if (params.messageId) {
            await botApi.unpinChatMessage(chatId, Number(params.messageId))
          } else {
            await botApi.unpinAllChatMessages(chatId)
          }
          result = { unpinned: true }
          break
        }

        // --- User management ---
        case 'ban_user': {
          await botApi.banChatMember(chatId, userId!)
          result = { banned: true }
          break
        }

        case 'mute_user':
        case 'restrict_user': {
          const perms = (params.permissions as Record<string, boolean>) ?? {}
          await botApi.restrictChatMember(chatId, userId!, {
            can_send_messages: perms.canSendMessages ?? false,
            can_send_other_messages: perms.canSendOther ?? false,
            can_add_web_page_previews: perms.canAddWebPagePreviews ?? false,
            can_change_info: perms.canChangeInfo ?? false,
            can_invite_users: perms.canInviteUsers ?? false,
            can_pin_messages: perms.canPinMessages ?? false,
          }, {
            until_date: params.untilDate ? Number(params.untilDate) : undefined,
          })
          result = { restricted: true }
          break
        }

        case 'promote_user': {
          const privs = (params.privileges as Record<string, boolean>) ?? {}
          await botApi.promoteChatMember(chatId, userId!, {
            can_manage_chat: privs.canManageChat,
            can_delete_messages: privs.canDeleteMessages,
            can_manage_video_chats: privs.canManageVideoChats,
            can_restrict_members: privs.canRestrictMembers,
            can_promote_members: privs.canPromoteMembers,
            can_change_info: privs.canChangeInfo,
            can_invite_users: privs.canInviteUsers,
            can_pin_messages: privs.canPinMessages,
          })
          result = { promoted: true }
          break
        }

        // --- Chat management ---
        case 'set_chat_title': {
          await botApi.setChatTitle(chatId, String(params.title ?? ''))
          result = { updated: true }
          break
        }

        case 'set_chat_description': {
          await botApi.setChatDescription(chatId, String(params.description ?? ''))
          result = { updated: true }
          break
        }

        case 'export_invite_link': {
          const link = await botApi.exportChatInviteLink(chatId)
          result = { inviteLink: link }
          break
        }

        case 'get_chat_member': {
          const member = await botApi.getChatMember(chatId, userId!)
          result = { userId: member.user.id, status: member.status }
          break
        }

        case 'leave_chat': {
          await botApi.leaveChat(chatId)
          result = { left: true }
          break
        }

        // --- Interactive ---
        case 'create_poll': {
          const pollOptions = ((params.options as string[]) ?? []).map(text => ({ text }))
          const msg = await botApi.sendPoll(chatId, String(params.question ?? ''), pollOptions, {
            is_anonymous: params.isAnonymous as boolean | undefined,
            allows_multiple_answers: params.allowsMultipleAnswers as boolean | undefined,
            type: params.pollType as 'regular' | 'quiz' | undefined,
          })
          result = { messageId: msg.message_id }
          break
        }

        case 'answer_callback_query': {
          await botApi.answerCallbackQuery(String(params.callbackQueryId ?? ''), {
            text: params.text ? String(params.text) : undefined,
            show_alert: params.showAlert as boolean | undefined,
            url: params.url ? String(params.url) : undefined,
          })
          result = { answered: true }
          break
        }

        default:
          return c.json({ success: false, error: `Unknown action: ${action}` }, 400)
      }

      return c.json({ success: true, result })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error }, 'Failed to execute action via API')
      return c.json({ success: false, error: message }, 500)
    }
  })

  server.onError((error, c) => {
    logger.error({ err: error, path: c.req.path })
    return c.json({ error: 'Internal server error' }, 500)
  })
}

export function createServer(dependencies: WebhookDependencies) {
  const { bot, config } = dependencies
  const server = new Hono()

  addApiRoutes(server, dependencies)

  server.post(
    '/webhook',
    webhookCallback(bot, 'hono', {
      secretToken: config.botWebhookSecret,
    }),
  )

  return server
}

export function createApiServer(dependencies: ApiDependencies) {
  const server = new Hono()
  addApiRoutes(server, dependencies)
  return server
}

export function createServerManager(server: Hono, options: { host: string, port: number }) {
  let handle: undefined | ReturnType<typeof serve>
  return {
    start() {
      return new Promise<{ url: string }>((resolve) => {
        handle = serve(
          {
            fetch: server.fetch,
            hostname: options.host,
            port: options.port,
          },
          info => resolve({
            url: info.family === 'IPv6'
              ? `http://[${info.address}]:${info.port}`
              : `http://${info.address}:${info.port}`,
          }),
        )
      })
    },
    stop() {
      return new Promise<void>((resolve) => {
        if (handle)
          handle.close(() => resolve())
        else
          resolve()
      })
    },
  }
}
