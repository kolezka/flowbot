import type { tl } from '@mtcute/node'
import { Long, TelegramClient } from '@mtcute/node'
import type { Logger } from 'pino'
import { ConnectorError } from '@flowbot/platform-kit'
import type {
  AdminPrivileges,
  ChatMemberInfo,
  ChatPermissions,
  ForwardOptions,
  ITelegramUserTransport,
  MediaOptions,
  MessageResult,
  PeerInfo,
  SendOptions,
} from './types.js'

export interface MtcuteClientConfig {
  sessionString: string
  apiId: number
  apiHash: string
  logger: Logger
}

/**
 * Convert our interface's peer (string | bigint) to mtcute's InputPeerLike (string | number).
 * Strings pass through; bigints convert to number (Telegram IDs fit in JS int53).
 */
function toInputPeer(peer: string | bigint): string | number {
  if (typeof peer === 'string') return peer
  return Number(peer)
}

/**
 * Convert an mtcute Message to our MessageResult interface.
 * mtcute Message.date is a Date object; we need a UNIX timestamp (seconds).
 * mtcute Message.chat.id is a number; we convert to bigint for our interface.
 */
function messageToResult(msg: { id: number; date: Date; chat: { id: number } }): MessageResult {
  return {
    id: msg.id,
    date: Math.floor(msg.date.getTime() / 1000),
    peerId: BigInt(msg.chat.id),
  }
}

/**
 * Determine peer type from a tl.TypeInputPeer discriminated union.
 */
function resolvePeerType(peer: tl.TypeInputPeer): 'user' | 'chat' | 'channel' {
  switch (peer._) {
    case 'inputPeerUser':
    case 'inputPeerUserFromMessage':
    case 'inputPeerSelf':
      return 'user'
    case 'inputPeerChannel':
    case 'inputPeerChannelFromMessage':
      return 'channel'
    case 'inputPeerChat':
      return 'chat'
    default:
      return 'user'
  }
}

/**
 * Extract peer ID from a tl.TypeInputPeer.
 */
function extractPeerId(peer: tl.TypeInputPeer): bigint {
  switch (peer._) {
    case 'inputPeerUser':
    case 'inputPeerUserFromMessage':
      return BigInt((peer as tl.RawInputPeerUser).userId)
    case 'inputPeerChannel':
    case 'inputPeerChannelFromMessage':
      return BigInt((peer as tl.RawInputPeerChannel).channelId)
    case 'inputPeerChat':
      return BigInt((peer as tl.RawInputPeerChat).chatId)
    case 'inputPeerSelf':
      return BigInt(0)
    default:
      return BigInt(0)
  }
}

/**
 * Extract access hash from a tl.TypeInputPeer.
 */
function extractAccessHash(peer: tl.TypeInputPeer): bigint {
  if (peer._ === 'inputPeerUser' && 'accessHash' in peer) {
    return BigInt(peer.accessHash.toString())
  }
  if (peer._ === 'inputPeerChannel' && 'accessHash' in peer) {
    return BigInt(peer.accessHash.toString())
  }
  return BigInt(0)
}

/**
 * mtcute (MTProto) implementation of ITelegramUserTransport.
 * Connects to Telegram using a session string.
 *
 * Unit tests use FakeTelegramUserTransport instead -- this class requires a live session.
 */
export class MtcuteClient implements ITelegramUserTransport {
  private readonly client: TelegramClient
  private readonly sessionString: string
  private readonly logger: Logger

  constructor({ sessionString, apiId, apiHash, logger }: MtcuteClientConfig) {
    this.logger = logger.child({ component: 'MtcuteClient' })
    this.sessionString = sessionString
    this.client = new TelegramClient({
      apiId,
      apiHash,
      storage: 'mtcute-transport.session',
    })
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Telegram...')
      await this.client.importSession(this.sessionString)
      await this.client.connect()
      this.logger.info('Connected to Telegram')
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to connect to Telegram')
      throw new ConnectorError('Failed to connect to Telegram', 'TRANSPORT_ERROR', error)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Telegram...')
      await this.client.disconnect()
      this.logger.info('Disconnected from Telegram')
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to disconnect from Telegram')
      throw new ConnectorError('Failed to disconnect from Telegram', 'TRANSPORT_ERROR', error)
    }
  }

  isConnected(): boolean {
    return this.client.isConnected
  }

  getClient(): TelegramClient {
    return this.client
  }

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  async sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, textLength: text.length }, 'Sending message')

      const result = await this.client.sendText(toInputPeer(peer), text, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Message sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send message')
      throw new ConnectorError('Failed to send message', 'TRANSPORT_ERROR', error)
    }
  }

  async forwardMessage(
    fromPeer: string | bigint,
    toPeer: string | bigint,
    messageIds: number[],
    options?: ForwardOptions,
  ): Promise<MessageResult[]> {
    try {
      this.logger.debug({ fromPeer, toPeer, messageIds }, 'Forwarding messages')

      const results = await this.client.forwardMessagesById({
        fromChatId: toInputPeer(fromPeer),
        toChatId: toInputPeer(toPeer),
        messages: messageIds,
        silent: options?.silent,
        noAuthor: options?.dropAuthor,
      })

      this.logger.debug({ count: results.length }, 'Messages forwarded')
      return results.map(messageToResult)
    } catch (error) {
      this.logger.error({ err: error, fromPeer, toPeer }, 'Failed to forward messages')
      throw new ConnectorError('Failed to forward messages', 'TRANSPORT_ERROR', error)
    }
  }

  async resolveUsername(username: string): Promise<PeerInfo> {
    try {
      this.logger.debug({ username }, 'Resolving username')

      const inputPeer = await this.client.resolvePeer(username)
      const type = resolvePeerType(inputPeer)
      const id = extractPeerId(inputPeer)
      const accessHash = extractAccessHash(inputPeer)

      this.logger.debug({ username, id: id.toString(), type }, 'Username resolved')
      return { id, accessHash, type }
    } catch (error) {
      this.logger.error({ err: error, username }, 'Failed to resolve username')
      throw new ConnectorError(`Failed to resolve username: ${username}`, 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Media messaging
  // ---------------------------------------------------------------------------

  async sendPhoto(peer: string | bigint, photoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, photoUrl }, 'Sending photo')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'photo',
        file: photoUrl,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Photo sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send photo')
      throw new ConnectorError('Failed to send photo', 'TRANSPORT_ERROR', error)
    }
  }

  async sendVideo(peer: string | bigint, videoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, videoUrl }, 'Sending video')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'video',
        file: videoUrl,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Video sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send video')
      throw new ConnectorError('Failed to send video', 'TRANSPORT_ERROR', error)
    }
  }

  async sendDocument(peer: string | bigint, documentUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, documentUrl }, 'Sending document')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'document',
        file: documentUrl,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Document sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send document')
      throw new ConnectorError('Failed to send document', 'TRANSPORT_ERROR', error)
    }
  }

  async sendSticker(peer: string | bigint, sticker: string, options?: { silent?: boolean }): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, sticker }, 'Sending sticker')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'sticker',
        file: sticker,
      }, {
        silent: options?.silent,
      })

      this.logger.debug({ messageId: result.id }, 'Sticker sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send sticker')
      throw new ConnectorError('Failed to send sticker', 'TRANSPORT_ERROR', error)
    }
  }

  async sendVoice(peer: string | bigint, voiceUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, voiceUrl }, 'Sending voice')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'voice',
        file: voiceUrl,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Voice sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send voice')
      throw new ConnectorError('Failed to send voice', 'TRANSPORT_ERROR', error)
    }
  }

  async sendAudio(peer: string | bigint, audioUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, audioUrl }, 'Sending audio')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'audio',
        file: audioUrl,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Audio sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send audio')
      throw new ConnectorError('Failed to send audio', 'TRANSPORT_ERROR', error)
    }
  }

  async sendAnimation(peer: string | bigint, animationUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, animationUrl }, 'Sending animation')

      // mtcute has no dedicated animation type -- use video with isAnimated flag
      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'video',
        file: animationUrl,
        isAnimated: true,
        caption: options?.caption,
        fileName: options?.fileName,
      }, {
        silent: options?.silent,
        replyTo: options?.replyToMsgId,
      })

      this.logger.debug({ messageId: result.id }, 'Animation sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send animation')
      throw new ConnectorError('Failed to send animation', 'TRANSPORT_ERROR', error)
    }
  }

  async sendLocation(
    peer: string | bigint,
    latitude: number,
    longitude: number,
    options?: { livePeriod?: number; silent?: boolean },
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, latitude, longitude }, 'Sending location')

      const media = options?.livePeriod
        ? { type: 'geo_live' as const, latitude, longitude, period: options.livePeriod }
        : { type: 'geo' as const, latitude, longitude }

      const result = await this.client.sendMedia(toInputPeer(peer), media, {
        silent: options?.silent,
      })

      this.logger.debug({ messageId: result.id }, 'Location sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send location')
      throw new ConnectorError('Failed to send location', 'TRANSPORT_ERROR', error)
    }
  }

  async sendContact(
    peer: string | bigint,
    phoneNumber: string,
    firstName: string,
    lastName?: string,
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, phoneNumber, firstName }, 'Sending contact')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'contact',
        phone: phoneNumber,
        firstName,
        lastName: lastName ?? '',
      })

      this.logger.debug({ messageId: result.id }, 'Contact sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send contact')
      throw new ConnectorError('Failed to send contact', 'TRANSPORT_ERROR', error)
    }
  }

  async sendVenue(
    peer: string | bigint,
    latitude: number,
    longitude: number,
    title: string,
    address: string,
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, latitude, longitude, title }, 'Sending venue')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'venue',
        latitude,
        longitude,
        title,
        address,
      })

      this.logger.debug({ messageId: result.id }, 'Venue sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send venue')
      throw new ConnectorError('Failed to send venue', 'TRANSPORT_ERROR', error)
    }
  }

  async sendDice(peer: string | bigint, emoji?: string): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, emoji }, 'Sending dice')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'dice',
        emoji: emoji ?? '\uD83C\uDFB2',
      })

      this.logger.debug({ messageId: result.id }, 'Dice sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send dice')
      throw new ConnectorError('Failed to send dice', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Message management
  // ---------------------------------------------------------------------------

  async copyMessage(
    fromPeer: string | bigint,
    toPeer: string | bigint,
    messageId: number,
  ): Promise<MessageResult[]> {
    try {
      this.logger.debug({ fromPeer, toPeer, messageId }, 'Copying message')
      const results = await this.forwardMessage(fromPeer, toPeer, [messageId], { dropAuthor: true })
      this.logger.debug({ count: results.length }, 'Message copied')
      return results
    } catch (error) {
      if (error instanceof ConnectorError) throw error
      this.logger.error({ err: error, fromPeer, toPeer, messageId }, 'Failed to copy message')
      throw new ConnectorError('Failed to copy message', 'TRANSPORT_ERROR', error)
    }
  }

  async editMessage(
    peer: string | bigint,
    messageId: number,
    text: string,
    _options?: SendOptions,
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, messageId }, 'Editing message')

      const result = await this.client.editMessage({
        chatId: toInputPeer(peer),
        message: messageId,
        text,
      })

      this.logger.debug({ messageId: result.id }, 'Message edited')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to edit message')
      throw new ConnectorError('Failed to edit message', 'TRANSPORT_ERROR', error)
    }
  }

  async deleteMessages(peer: string | bigint, messageIds: number[]): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageIds }, 'Deleting messages')

      await this.client.deleteMessagesById(toInputPeer(peer), messageIds, { revoke: true })

      this.logger.debug({ count: messageIds.length }, 'Messages deleted')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, messageIds }, 'Failed to delete messages')
      throw new ConnectorError('Failed to delete messages', 'TRANSPORT_ERROR', error)
    }
  }

  async pinMessage(peer: string | bigint, messageId: number, silent?: boolean): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageId, silent }, 'Pinning message')

      await this.client.pinMessage({
        chatId: toInputPeer(peer),
        message: messageId,
        notify: silent === true ? false : undefined,
      })

      this.logger.debug({ messageId }, 'Message pinned')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to pin message')
      throw new ConnectorError('Failed to pin message', 'TRANSPORT_ERROR', error)
    }
  }

  async unpinMessage(peer: string | bigint, messageId?: number): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageId }, 'Unpinning message')

      if (messageId === undefined) {
        await this.client.unpinAllMessages(toInputPeer(peer))
      } else {
        await this.client.unpinMessage({
          chatId: toInputPeer(peer),
          message: messageId,
        })
      }

      this.logger.debug({ messageId }, 'Message unpinned')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to unpin message')
      throw new ConnectorError('Failed to unpin message', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------

  async banUser(peer: string | bigint, userId: string | bigint): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId }, 'Banning user')

      await this.client.banChatMember({
        chatId: toInputPeer(peer),
        participantId: toInputPeer(userId),
      })

      this.logger.debug({ userId }, 'User banned')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to ban user')
      throw new ConnectorError('Failed to ban user', 'TRANSPORT_ERROR', error)
    }
  }

  async restrictUser(
    peer: string | bigint,
    userId: string | bigint,
    permissions: ChatPermissions,
    untilDate?: number,
  ): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId, permissions }, 'Restricting user')

      // mtcute restrictions use INVERTED semantics: true = disallowed
      // Our interface: canSendMessages=false means "cannot send" -> restriction=true
      await this.client.restrictChatMember({
        chatId: toInputPeer(peer),
        userId: toInputPeer(userId),
        restrictions: {
          sendMessages: permissions.canSendMessages === false ? true : undefined,
          sendMedia: permissions.canSendMedia === false ? true : undefined,
          sendPolls: permissions.canSendPolls === false ? true : undefined,
          sendStickers: permissions.canSendOther === false ? true : undefined,
          sendGifs: permissions.canSendOther === false ? true : undefined,
          sendGames: permissions.canSendOther === false ? true : undefined,
          sendInline: permissions.canSendOther === false ? true : undefined,
          embedLinks: permissions.canAddWebPagePreviews === false ? true : undefined,
          changeInfo: permissions.canChangeInfo === false ? true : undefined,
          inviteUsers: permissions.canInviteUsers === false ? true : undefined,
          pinMessages: permissions.canPinMessages === false ? true : undefined,
        },
        until: untilDate ?? 0,
      })

      this.logger.debug({ userId }, 'User restricted')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to restrict user')
      throw new ConnectorError('Failed to restrict user', 'TRANSPORT_ERROR', error)
    }
  }

  async promoteUser(
    peer: string | bigint,
    userId: string | bigint,
    privileges: AdminPrivileges,
  ): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId, privileges }, 'Promoting user')

      await this.client.editAdminRights({
        chatId: toInputPeer(peer),
        userId: toInputPeer(userId),
        rights: {
          manageCall: privileges.canManageVideoChats,
          deleteMessages: privileges.canDeleteMessages,
          banUsers: privileges.canRestrictMembers,
          addAdmins: privileges.canPromoteMembers,
          changeInfo: privileges.canChangeInfo,
          inviteUsers: privileges.canInviteUsers,
          pinMessages: privileges.canPinMessages,
          other: privileges.canManageChat,
        },
        rank: '',
      })

      this.logger.debug({ userId }, 'User promoted')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to promote user')
      throw new ConnectorError('Failed to promote user', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Chat management
  // ---------------------------------------------------------------------------

  async setChatTitle(peer: string | bigint, title: string): Promise<boolean> {
    try {
      this.logger.debug({ peer, title }, 'Setting chat title')

      await this.client.setChatTitle(toInputPeer(peer), title)

      this.logger.debug({ title }, 'Chat title set')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to set chat title')
      throw new ConnectorError('Failed to set chat title', 'TRANSPORT_ERROR', error)
    }
  }

  async setChatDescription(peer: string | bigint, description: string): Promise<boolean> {
    try {
      this.logger.debug({ peer }, 'Setting chat description')

      await this.client.setChatDescription(toInputPeer(peer), description)

      this.logger.debug('Chat description set')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to set chat description')
      throw new ConnectorError('Failed to set chat description', 'TRANSPORT_ERROR', error)
    }
  }

  async exportInviteLink(peer: string | bigint): Promise<string> {
    try {
      this.logger.debug({ peer }, 'Exporting invite link')

      const result = await this.client.createInviteLink(toInputPeer(peer))

      this.logger.debug('Invite link exported')
      return result.link
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to export invite link')
      throw new ConnectorError('Failed to export invite link', 'TRANSPORT_ERROR', error)
    }
  }

  async getChatMember(peer: string | bigint, userId: string | bigint): Promise<ChatMemberInfo> {
    try {
      this.logger.debug({ peer, userId }, 'Getting chat member')

      const member = await this.client.getChatMember({
        chatId: toInputPeer(peer),
        userId: toInputPeer(userId),
      })

      if (!member) {
        throw new ConnectorError('Chat member not found', 'NOT_FOUND')
      }

      const status = member.status

      this.logger.debug({ userId, status }, 'Chat member retrieved')
      return {
        userId: String(userId),
        status,
      }
    } catch (error) {
      if (error instanceof ConnectorError) throw error
      this.logger.error({ err: error, peer, userId }, 'Failed to get chat member')
      throw new ConnectorError('Failed to get chat member', 'TRANSPORT_ERROR', error)
    }
  }

  async leaveChat(peer: string | bigint): Promise<boolean> {
    try {
      this.logger.debug({ peer }, 'Leaving chat')

      await this.client.leaveChat(toInputPeer(peer))

      this.logger.debug('Left chat')
      return true
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to leave chat')
      throw new ConnectorError('Failed to leave chat', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Interactive
  // ---------------------------------------------------------------------------

  async createPoll(
    peer: string | bigint,
    question: string,
    answers: string[],
    options?: { isAnonymous?: boolean; multipleChoice?: boolean },
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, question, answerCount: answers.length }, 'Creating poll')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'poll',
        question,
        answers,
        public: options?.isAnonymous === false ? true : undefined,
        multiple: options?.multipleChoice,
      })

      this.logger.debug({ messageId: result.id }, 'Poll created')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to create poll')
      throw new ConnectorError('Failed to create poll', 'TRANSPORT_ERROR', error)
    }
  }

  async answerCallbackQuery(
    queryId: string,
    options?: { text?: string; showAlert?: boolean; url?: string },
  ): Promise<boolean> {
    try {
      this.logger.debug({ queryId }, 'Answering callback query')

      await this.client.answerCallbackQuery(Long.fromString(queryId), {
        text: options?.text,
        alert: options?.showAlert,
        url: options?.url,
      })

      this.logger.debug({ queryId }, 'Callback query answered')
      return true
    } catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer callback query')
      throw new ConnectorError('Failed to answer callback query', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Inline & Payments
  // ---------------------------------------------------------------------------

  async answerInlineQuery(
    queryId: string,
    _results: unknown[],
    _options?: { cacheTime?: number },
  ): Promise<boolean> {
    try {
      this.logger.debug({ queryId, resultCount: _results.length }, 'Answering inline query')

      // Stubbed -- inline result conversion requires per-type mapping
      await this.client.answerInlineQuery(Long.fromString(queryId), [], {
        cacheTime: _options?.cacheTime ?? 300,
      })

      return true
    } catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer inline query')
      throw new ConnectorError('Failed to answer inline query', 'TRANSPORT_ERROR', error)
    }
  }

  async sendInvoice(
    peer: string | bigint,
    params: {
      title: string
      description: string
      payload: string
      currency: string
      prices: Array<{ label: string; amount: number }>
    },
  ): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, title: params.title }, 'Sending invoice')

      const result = await this.client.sendMedia(toInputPeer(peer), {
        type: 'invoice',
        title: params.title,
        description: params.description,
        payload: new TextEncoder().encode(params.payload),
        invoice: {
          _: 'invoice',
          currency: params.currency,
          prices: params.prices.map((p) => ({
            _: 'labeledPrice' as const,
            label: p.label,
            amount: Long.fromNumber(p.amount),
          })),
        },
        token: '',
        providerData: {},
        startParam: '',
      })

      this.logger.debug({ messageId: result.id }, 'Invoice sent')
      return messageToResult(result)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send invoice')
      throw new ConnectorError('Failed to send invoice', 'TRANSPORT_ERROR', error)
    }
  }

  async answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean> {
    try {
      this.logger.debug({ queryId, ok }, 'Answering pre-checkout query')

      await this.client.answerPreCheckoutQuery(Long.fromString(queryId), {
        error: ok ? undefined : errorMessage,
      })

      return true
    } catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer pre-checkout query')
      throw new ConnectorError('Failed to answer pre-checkout query', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Bot configuration
  // ---------------------------------------------------------------------------

  async setChatMenuButton(
    _peer: string | bigint,
    _menuButton: { type: string; text?: string; url?: string },
  ): Promise<boolean> {
    // Bot API only feature -- MTProto equivalent requires Bot API method forwarding
    this.logger.warn('setChatMenuButton is only available via Bot API, not MTProto')
    return false
  }

  async setMyCommands(
    commands: Array<{ command: string; description: string }>,
    _scope?: unknown,
  ): Promise<boolean> {
    try {
      this.logger.debug({ commandCount: commands.length }, 'Setting bot commands')

      await this.client.setMyCommands({
        commands: commands.map((c) => ({
          _: 'botCommand' as const,
          command: c.command,
          description: c.description,
        })),
      })

      return true
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to set bot commands')
      throw new ConnectorError('Failed to set bot commands', 'TRANSPORT_ERROR', error)
    }
  }

  // ---------------------------------------------------------------------------
  // Media & Forum
  // ---------------------------------------------------------------------------

  async sendMediaGroup(
    peer: string | bigint,
    media: Array<{ type: string; url: string; caption?: string }>,
  ): Promise<MessageResult[]> {
    try {
      this.logger.debug({ peer, mediaCount: media.length }, 'Sending media group')

      const inputMedia = media.map((item) => {
        if (item.type === 'photo') {
          return { type: 'photo' as const, file: item.url, caption: item.caption }
        }
        if (item.type === 'video') {
          return { type: 'video' as const, file: item.url, caption: item.caption }
        }
        return { type: 'document' as const, file: item.url, caption: item.caption }
      })

      const results = await this.client.sendMediaGroup(toInputPeer(peer), inputMedia)

      this.logger.debug({ count: results.length }, 'Media group sent')
      return results.map(messageToResult)
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send media group')
      throw new ConnectorError('Failed to send media group', 'TRANSPORT_ERROR', error)
    }
  }

  async createForumTopic(
    peer: string | bigint,
    name: string,
    options?: { iconColor?: number; iconEmojiId?: string },
  ): Promise<number> {
    try {
      this.logger.debug({ peer, name }, 'Creating forum topic')

      const icon = options?.iconEmojiId
        ? Long.fromString(options.iconEmojiId)
        : options?.iconColor

      const result = await this.client.createForumTopic({
        chatId: toInputPeer(peer),
        title: name,
        icon,
      })

      const topicId = result.id
      this.logger.debug({ topicId }, 'Forum topic created')
      return topicId
    } catch (error) {
      this.logger.error({ err: error, peer, name }, 'Failed to create forum topic')
      throw new ConnectorError('Failed to create forum topic', 'TRANSPORT_ERROR', error)
    }
  }
}
