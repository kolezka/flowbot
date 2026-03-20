import { Bot } from 'grammy'
import type { Logger } from 'pino'
import { ConnectorError } from '@flowbot/platform-kit'
import type {
  ITelegramBotTransport,
  TelegramChatMemberResult,
  TelegramChatResult,
  TelegramMessageResult,
  TelegramPollOptions,
  TelegramPromoteOptions,
  TelegramRestrictOptions,
  TelegramSendMediaOptions,
  TelegramSendMessageOptions,
} from './types.js'

interface GrammyBotConfig {
  botToken: string
  logger: Logger
}

/**
 * Real grammY implementation of ITelegramBotTransport.
 * Wraps the grammY Bot API for all bot-account actions.
 *
 * Unit tests use FakeTelegramBot instead — this class requires a live bot token.
 */
export class GrammyBot implements ITelegramBotTransport {
  private readonly bot: Bot
  private readonly logger: Logger
  private running = false

  constructor({ botToken, logger }: GrammyBotConfig) {
    this.bot = new Bot(botToken)
    this.logger = logger
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      await this.bot.start()
      this.running = true
      this.logger.info('Telegram bot started')
    } catch (err) {
      throw new ConnectorError('Failed to start Telegram bot', 'TRANSPORT_ERROR', err)
    }
  }

  async stop(): Promise<void> {
    try {
      await this.bot.stop()
      this.running = false
      this.logger.info('Telegram bot stopped')
    } catch (err) {
      throw new ConnectorError('Failed to stop Telegram bot', 'TRANSPORT_ERROR', err)
    }
  }

  isRunning(): boolean {
    return this.running
  }

  getBot(): Bot {
    return this.bot
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  async sendMessage(
    chatId: string,
    text: string,
    opts?: TelegramSendMessageOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendMessage(chatId, text, {
        parse_mode: opts?.parseMode,
        disable_notification: opts?.disableNotification,
        reply_parameters: opts?.replyToMessageId
          ? { message_id: opts.replyToMessageId }
          : undefined,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send message to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendPhoto(
    chatId: string,
    photoUrl: string,
    opts?: TelegramSendMediaOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendPhoto(chatId, photoUrl, {
        caption: opts?.caption,
        parse_mode: opts?.parseMode,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send photo to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendVideo(
    chatId: string,
    videoUrl: string,
    opts?: TelegramSendMediaOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendVideo(chatId, videoUrl, {
        caption: opts?.caption,
        parse_mode: opts?.parseMode,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send video to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendDocument(
    chatId: string,
    documentUrl: string,
    opts?: TelegramSendMediaOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendDocument(chatId, documentUrl, {
        caption: opts?.caption,
        parse_mode: opts?.parseMode,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send document to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendAudio(
    chatId: string,
    audioUrl: string,
    opts?: TelegramSendMediaOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendAudio(chatId, audioUrl, {
        caption: opts?.caption,
        parse_mode: opts?.parseMode,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send audio to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendVoice(
    chatId: string,
    voiceUrl: string,
    opts?: Pick<TelegramSendMediaOptions, 'caption'>,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendVoice(chatId, voiceUrl, {
        caption: opts?.caption,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send voice to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendSticker(chatId: string, sticker: string): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendSticker(chatId, sticker)
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send sticker to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendLocation(
    chatId: string,
    latitude: number,
    longitude: number,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendLocation(chatId, latitude, longitude)
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send location to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendContact(
    chatId: string,
    phoneNumber: string,
    firstName: string,
    lastName?: string,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendContact(chatId, phoneNumber, firstName, {
        last_name: lastName,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send contact to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async sendPoll(
    chatId: string,
    question: string,
    options: string[],
    opts?: TelegramPollOptions,
  ): Promise<TelegramMessageResult> {
    try {
      const pollOptions = options.map(text => ({ text }))
      const msg = await this.bot.api.sendPoll(chatId, question, pollOptions, {
        is_anonymous: opts?.isAnonymous,
        allows_multiple_answers: opts?.allowsMultipleAnswers,
        type: opts?.pollType,
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to send poll to ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Edit / Delete
  // ---------------------------------------------------------------------------

  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
    opts?: Pick<TelegramSendMessageOptions, 'parseMode'>,
  ): Promise<void> {
    try {
      await this.bot.api.editMessageText(chatId, messageId, text, {
        parse_mode: opts?.parseMode,
      })
    } catch (err) {
      throw new ConnectorError(`Failed to edit message ${messageId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    try {
      await this.bot.api.deleteMessage(chatId, messageId)
    } catch (err) {
      throw new ConnectorError(`Failed to delete message ${messageId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Pin
  // ---------------------------------------------------------------------------

  async pinMessage(
    chatId: string,
    messageId: number,
    disableNotification?: boolean,
  ): Promise<void> {
    try {
      await this.bot.api.pinChatMessage(chatId, messageId, {
        disable_notification: disableNotification,
      })
    } catch (err) {
      throw new ConnectorError(`Failed to pin message ${messageId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async unpinMessage(chatId: string, messageId?: number): Promise<void> {
    try {
      if (messageId !== undefined) {
        await this.bot.api.unpinChatMessage(chatId, messageId)
      } else {
        await this.bot.api.unpinAllChatMessages(chatId)
      }
    } catch (err) {
      throw new ConnectorError(`Failed to unpin message in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Reply
  // ---------------------------------------------------------------------------

  async replyToMessage(
    chatId: string,
    messageId: number,
    text: string,
    opts?: Pick<TelegramSendMessageOptions, 'parseMode' | 'disableNotification'>,
  ): Promise<TelegramMessageResult> {
    try {
      const msg = await this.bot.api.sendMessage(chatId, text, {
        parse_mode: opts?.parseMode,
        disable_notification: opts?.disableNotification,
        reply_parameters: { message_id: messageId },
      })
      return { messageId: msg.message_id }
    } catch (err) {
      throw new ConnectorError(`Failed to reply to message ${messageId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async banUser(chatId: string, userId: number): Promise<void> {
    try {
      await this.bot.api.banChatMember(chatId, userId)
    } catch (err) {
      throw new ConnectorError(`Failed to ban user ${userId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async unbanUser(chatId: string, userId: number): Promise<void> {
    try {
      await this.bot.api.unbanChatMember(chatId, userId)
    } catch (err) {
      throw new ConnectorError(`Failed to unban user ${userId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async restrictUser(
    chatId: string,
    userId: number,
    opts?: TelegramRestrictOptions,
  ): Promise<void> {
    try {
      await this.bot.api.restrictChatMember(
        chatId,
        userId,
        {
          can_send_messages: opts?.canSendMessages ?? false,
          can_send_other_messages: opts?.canSendOther ?? false,
          can_add_web_page_previews: opts?.canAddWebPagePreviews ?? false,
          can_change_info: opts?.canChangeInfo ?? false,
          can_invite_users: opts?.canInviteUsers ?? false,
          can_pin_messages: opts?.canPinMessages ?? false,
        },
        { until_date: opts?.untilDate },
      )
    } catch (err) {
      throw new ConnectorError(`Failed to restrict user ${userId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async promoteUser(
    chatId: string,
    userId: number,
    opts?: TelegramPromoteOptions,
  ): Promise<void> {
    try {
      await this.bot.api.promoteChatMember(chatId, userId, {
        can_manage_chat: opts?.canManageChat,
        can_delete_messages: opts?.canDeleteMessages,
        can_manage_video_chats: opts?.canManageVideoChats,
        can_restrict_members: opts?.canRestrictMembers,
        can_promote_members: opts?.canPromoteMembers,
        can_change_info: opts?.canChangeInfo,
        can_invite_users: opts?.canInviteUsers,
        can_pin_messages: opts?.canPinMessages,
      })
    } catch (err) {
      throw new ConnectorError(`Failed to promote user ${userId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Chat info
  // ---------------------------------------------------------------------------

  async getChat(chatId: string): Promise<TelegramChatResult> {
    try {
      const chat = await this.bot.api.getChat(chatId)
      return {
        id: chat.id,
        type: chat.type,
        title: 'title' in chat ? chat.title : undefined,
        username: 'username' in chat ? chat.username : undefined,
        description: 'description' in chat ? (chat as { description?: string }).description : undefined,
      }
    } catch (err) {
      throw new ConnectorError(`Failed to get chat ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async getChatMember(chatId: string, userId: number): Promise<TelegramChatMemberResult> {
    try {
      const member = await this.bot.api.getChatMember(chatId, userId)
      return { userId: member.user.id, status: member.status }
    } catch (err) {
      throw new ConnectorError(`Failed to get chat member ${userId} in ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async getChatMembersCount(chatId: string): Promise<number> {
    try {
      return await this.bot.api.getChatMemberCount(chatId)
    } catch (err) {
      throw new ConnectorError(`Failed to get member count for ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async setChatTitle(chatId: string, title: string): Promise<void> {
    try {
      await this.bot.api.setChatTitle(chatId, title)
    } catch (err) {
      throw new ConnectorError(`Failed to set title for ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }

  async setChatDescription(chatId: string, description: string): Promise<void> {
    try {
      await this.bot.api.setChatDescription(chatId, description)
    } catch (err) {
      throw new ConnectorError(`Failed to set description for ${chatId}`, 'TRANSPORT_ERROR', err)
    }
  }
}
