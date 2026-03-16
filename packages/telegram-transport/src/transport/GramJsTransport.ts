import type { EntityLike } from 'telegram/define'

import type { StringSession } from 'telegram/sessions/index.js'
import type { Logger } from '../logger.js'
import type { AdminPrivileges, ChatMemberInfo, ChatPermissions, ForwardOptions, ITelegramTransport, MediaOptions, MessageResult, PeerInfo, SendOptions } from './ITelegramTransport.js'
import { TelegramClient } from 'telegram'

import { Api } from 'telegram/tl/index.js'
import { generateRandomLong, returnBigInt } from 'telegram/Helpers.js'
import { TransportError } from './errors.js'

function toEntityLike(peer: string | bigint): EntityLike {
  if (typeof peer === 'string')
    return peer
  return Number(peer)
}

function extractPeerId(peer: Api.TypePeer): string | bigint {
  if (peer instanceof Api.PeerUser)
    return BigInt(peer.userId.toString())
  if (peer instanceof Api.PeerChat)
    return BigInt(peer.chatId.toString())
  if (peer instanceof Api.PeerChannel)
    return BigInt(peer.channelId.toString())
  return String(peer)
}

function messageToResult(msg: Api.Message): MessageResult {
  return {
    id: msg.id,
    date: msg.date,
    peerId: msg.peerId ? extractPeerId(msg.peerId) : '',
  }
}

function resolvePeerType(entity: Api.User | Api.Chat | Api.Channel): 'user' | 'chat' | 'channel' {
  if (entity instanceof Api.User)
    return 'user'
  if (entity instanceof Api.Channel)
    return 'channel'
  return 'chat'
}

export class GramJsTransport implements ITelegramTransport {
  private readonly client: TelegramClient
  private readonly logger: Logger

  constructor(apiId: number, apiHash: string, session: StringSession, logger: Logger) {
    this.logger = logger.child({ component: 'GramJsTransport' })
    this.client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    })
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Telegram...')
      await this.client.connect()
      this.logger.info('Connected to Telegram')
    }
    catch (error) {
      this.logger.error({ err: error }, 'Failed to connect to Telegram')
      throw new TransportError('Failed to connect to Telegram', error)
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Telegram...')
      await this.client.disconnect()
      this.logger.info('Disconnected from Telegram')
    }
    catch (error) {
      this.logger.error({ err: error }, 'Failed to disconnect from Telegram')
      throw new TransportError('Failed to disconnect from Telegram', error)
    }
  }

  isConnected(): boolean {
    return this.client.connected ?? false
  }

  async sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, textLength: text.length }, 'Sending message')

      const result = await this.client.sendMessage(toEntityLike(peer), {
        message: text,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })

      this.logger.debug({ messageId: result.id }, 'Message sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send message')
      throw new TransportError('Failed to send message', error)
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

      const results = await this.client.forwardMessages(toEntityLike(toPeer), {
        messages: messageIds,
        fromPeer: toEntityLike(fromPeer),
        silent: options?.silent,
        dropAuthor: options?.dropAuthor,
      })

      this.logger.debug({ count: results.length }, 'Messages forwarded')
      return results.map(messageToResult)
    }
    catch (error) {
      this.logger.error({ err: error, fromPeer, toPeer }, 'Failed to forward messages')
      throw new TransportError('Failed to forward messages', error)
    }
  }

  async resolveUsername(username: string): Promise<PeerInfo> {
    try {
      this.logger.debug({ username }, 'Resolving username')

      const entity = await this.client.getEntity(username) as Api.User | Api.Chat | Api.Channel

      const type = resolvePeerType(entity)
      const id = 'id' in entity ? BigInt(entity.id.toString()) : BigInt(0)
      const accessHash = 'accessHash' in entity && entity.accessHash
        ? BigInt(entity.accessHash.toString())
        : BigInt(0)

      this.logger.debug({ username, id: id.toString(), type }, 'Username resolved')
      return { id, accessHash, type }
    }
    catch (error) {
      this.logger.error({ err: error, username }, 'Failed to resolve username')
      throw new TransportError(`Failed to resolve username: ${username}`, error)
    }
  }

  // --- Media messaging ---

  async sendPhoto(peer: string | bigint, photoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, photoUrl }, 'Sending photo')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: photoUrl,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Photo sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send photo')
      throw new TransportError('Failed to send photo', error)
    }
  }

  async sendVideo(peer: string | bigint, videoUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, videoUrl }, 'Sending video')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: videoUrl,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Video sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send video')
      throw new TransportError('Failed to send video', error)
    }
  }

  async sendDocument(peer: string | bigint, documentUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, documentUrl }, 'Sending document')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: documentUrl,
        forceDocument: true,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Document sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send document')
      throw new TransportError('Failed to send document', error)
    }
  }

  async sendSticker(peer: string | bigint, sticker: string, options?: { silent?: boolean }): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, sticker }, 'Sending sticker')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: sticker,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Sticker sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send sticker')
      throw new TransportError('Failed to send sticker', error)
    }
  }

  async sendVoice(peer: string | bigint, voiceUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, voiceUrl }, 'Sending voice')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: voiceUrl,
        voiceNote: true,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Voice sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send voice')
      throw new TransportError('Failed to send voice', error)
    }
  }

  async sendAudio(peer: string | bigint, audioUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, audioUrl }, 'Sending audio')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: audioUrl,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Audio sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send audio')
      throw new TransportError('Failed to send audio', error)
    }
  }

  async sendAnimation(peer: string | bigint, animationUrl: string, options?: MediaOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, animationUrl }, 'Sending animation')
      const result = await this.client.sendFile(toEntityLike(peer), {
        file: animationUrl,
        caption: options?.caption,
        parseMode: options?.parseMode,
        replyTo: options?.replyToMsgId,
        silent: options?.silent,
      })
      this.logger.debug({ messageId: result.id }, 'Animation sent')
      return messageToResult(result)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send animation')
      throw new TransportError('Failed to send animation', error)
    }
  }

  async sendLocation(peer: string | bigint, latitude: number, longitude: number, options?: { livePeriod?: number, silent?: boolean }): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, latitude, longitude }, 'Sending location')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaGeoPoint({
            geoPoint: new Api.InputGeoPoint({ lat: latitude, long: longitude }),
          }),
          message: '',
          silent: options?.silent,
          randomId: generateRandomLong(),
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Location sent')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send location')
      throw new TransportError('Failed to send location', error)
    }
  }

  async sendContact(peer: string | bigint, phoneNumber: string, firstName: string, lastName?: string): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, phoneNumber, firstName }, 'Sending contact')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaContact({
            phoneNumber,
            firstName,
            lastName: lastName ?? '',
            vcard: '',
          }),
          message: '',
          randomId: generateRandomLong(),
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Contact sent')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send contact')
      throw new TransportError('Failed to send contact', error)
    }
  }

  async sendVenue(peer: string | bigint, latitude: number, longitude: number, title: string, address: string): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, latitude, longitude, title }, 'Sending venue')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaVenue({
            geoPoint: new Api.InputGeoPoint({ lat: latitude, long: longitude }),
            title,
            address,
            provider: '',
            venueId: '',
            venueType: '',
          }),
          message: '',
          randomId: generateRandomLong(),
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Venue sent')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send venue')
      throw new TransportError('Failed to send venue', error)
    }
  }

  async sendDice(peer: string | bigint, emoji?: string): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, emoji }, 'Sending dice')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaDice({
            emoticon: emoji ?? '\uD83C\uDFB2',
          }),
          message: '',
          randomId: generateRandomLong(),
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Dice sent')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send dice')
      throw new TransportError('Failed to send dice', error)
    }
  }

  // --- Message management ---

  async copyMessage(fromPeer: string | bigint, toPeer: string | bigint, messageId: number): Promise<MessageResult[]> {
    try {
      this.logger.debug({ fromPeer, toPeer, messageId }, 'Copying message')
      const results = await this.forwardMessage(fromPeer, toPeer, [messageId], { dropAuthor: true })
      this.logger.debug({ count: results.length }, 'Message copied')
      return results
    }
    catch (error) {
      this.logger.error({ err: error, fromPeer, toPeer, messageId }, 'Failed to copy message')
      throw new TransportError('Failed to copy message', error)
    }
  }

  async editMessage(peer: string | bigint, messageId: number, text: string, options?: SendOptions): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, messageId }, 'Editing message')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.EditMessage({
          peer: entity,
          id: messageId,
          message: text,
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Message edited')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to edit message')
      throw new TransportError('Failed to edit message', error)
    }
  }

  async deleteMessages(peer: string | bigint, messageIds: number[]): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageIds }, 'Deleting messages')
      try {
        const entity = await this.client.getInputEntity(toEntityLike(peer))
        await this.client.invoke(
          new Api.channels.DeleteMessages({
            channel: entity,
            id: messageIds,
          }),
        )
      }
      catch {
        await this.client.invoke(
          new Api.messages.DeleteMessages({
            id: messageIds,
            revoke: true,
          }),
        )
      }
      this.logger.debug({ count: messageIds.length }, 'Messages deleted')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, messageIds }, 'Failed to delete messages')
      throw new TransportError('Failed to delete messages', error)
    }
  }

  async pinMessage(peer: string | bigint, messageId: number, silent?: boolean): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageId, silent }, 'Pinning message')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      await this.client.invoke(
        new Api.messages.UpdatePinnedMessage({
          peer: entity,
          id: messageId,
          silent,
        }),
      )
      this.logger.debug({ messageId }, 'Message pinned')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to pin message')
      throw new TransportError('Failed to pin message', error)
    }
  }

  async unpinMessage(peer: string | bigint, messageId?: number): Promise<boolean> {
    try {
      this.logger.debug({ peer, messageId }, 'Unpinning message')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      await this.client.invoke(
        new Api.messages.UpdatePinnedMessage({
          peer: entity,
          id: messageId ?? 0,
          unpin: true,
        }),
      )
      this.logger.debug({ messageId }, 'Message unpinned')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, messageId }, 'Failed to unpin message')
      throw new TransportError('Failed to unpin message', error)
    }
  }

  // --- User management ---

  async banUser(peer: string | bigint, userId: string | bigint): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId }, 'Banning user')
      const channel = await this.client.getInputEntity(toEntityLike(peer))
      const participant = await this.client.getInputEntity(toEntityLike(userId))
      await this.client.invoke(
        new Api.channels.EditBanned({
          channel,
          participant,
          bannedRights: new Api.ChatBannedRights({
            untilDate: 0,
            viewMessages: true,
            sendMessages: true,
            sendMedia: true,
            sendStickers: true,
            sendGifs: true,
            sendGames: true,
            sendInline: true,
            embedLinks: true,
          }),
        }),
      )
      this.logger.debug({ userId }, 'User banned')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to ban user')
      throw new TransportError('Failed to ban user', error)
    }
  }

  async restrictUser(peer: string | bigint, userId: string | bigint, permissions: ChatPermissions, untilDate?: number): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId, permissions }, 'Restricting user')
      const channel = await this.client.getInputEntity(toEntityLike(peer))
      const participant = await this.client.getInputEntity(toEntityLike(userId))
      await this.client.invoke(
        new Api.channels.EditBanned({
          channel,
          participant,
          bannedRights: new Api.ChatBannedRights({
            untilDate: untilDate ?? 0,
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
          }),
        }),
      )
      this.logger.debug({ userId }, 'User restricted')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to restrict user')
      throw new TransportError('Failed to restrict user', error)
    }
  }

  async promoteUser(peer: string | bigint, userId: string | bigint, privileges: AdminPrivileges): Promise<boolean> {
    try {
      this.logger.debug({ peer, userId, privileges }, 'Promoting user')
      const channel = await this.client.getInputEntity(toEntityLike(peer))
      const user = await this.client.getInputEntity(toEntityLike(userId))
      await this.client.invoke(
        new Api.channels.EditAdmin({
          channel,
          userId: user,
          adminRights: new Api.ChatAdminRights({
            manageCall: privileges.canManageVideoChats,
            deleteMessages: privileges.canDeleteMessages,
            banUsers: privileges.canRestrictMembers,
            addAdmins: privileges.canPromoteMembers,
            changeInfo: privileges.canChangeInfo,
            inviteUsers: privileges.canInviteUsers,
            pinMessages: privileges.canPinMessages,
            other: privileges.canManageChat,
          }),
          rank: '',
        }),
      )
      this.logger.debug({ userId }, 'User promoted')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to promote user')
      throw new TransportError('Failed to promote user', error)
    }
  }

  // --- Chat management ---

  async setChatTitle(peer: string | bigint, title: string): Promise<boolean> {
    try {
      this.logger.debug({ peer, title }, 'Setting chat title')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      await this.client.invoke(
        new Api.channels.EditTitle({
          channel: entity,
          title,
        }),
      )
      this.logger.debug({ title }, 'Chat title set')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to set chat title')
      throw new TransportError('Failed to set chat title', error)
    }
  }

  async setChatDescription(peer: string | bigint, description: string): Promise<boolean> {
    try {
      this.logger.debug({ peer }, 'Setting chat description')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      await this.client.invoke(
        new Api.messages.EditChatAbout({
          peer: entity,
          about: description,
        }),
      )
      this.logger.debug('Chat description set')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to set chat description')
      throw new TransportError('Failed to set chat description', error)
    }
  }

  async exportInviteLink(peer: string | bigint): Promise<string> {
    try {
      this.logger.debug({ peer }, 'Exporting invite link')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.ExportChatInvite({
          peer: entity,
        }),
      )
      const link = (result as Api.ChatInviteExported).link
      this.logger.debug('Invite link exported')
      return link
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to export invite link')
      throw new TransportError('Failed to export invite link', error)
    }
  }

  async getChatMember(peer: string | bigint, userId: string | bigint): Promise<ChatMemberInfo> {
    try {
      this.logger.debug({ peer, userId }, 'Getting chat member')
      const channel = await this.client.getInputEntity(toEntityLike(peer))
      const participant = await this.client.getInputEntity(toEntityLike(userId))
      const result = await this.client.invoke(
        new Api.channels.GetParticipant({
          channel,
          participant,
        }),
      )
      const p = result.participant
      let status = 'member'
      if (p instanceof Api.ChannelParticipantCreator) status = 'creator'
      else if (p instanceof Api.ChannelParticipantAdmin) status = 'administrator'
      else if (p instanceof Api.ChannelParticipantBanned) status = 'banned'
      else if (p instanceof Api.ChannelParticipantLeft) status = 'left'

      this.logger.debug({ userId, status }, 'Chat member retrieved')
      return {
        userId: String(userId),
        status,
      }
    }
    catch (error) {
      this.logger.error({ err: error, peer, userId }, 'Failed to get chat member')
      throw new TransportError('Failed to get chat member', error)
    }
  }

  async leaveChat(peer: string | bigint): Promise<boolean> {
    try {
      this.logger.debug({ peer }, 'Leaving chat')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      await this.client.invoke(
        new Api.channels.LeaveChannel({
          channel: entity,
        }),
      )
      this.logger.debug('Left chat')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to leave chat')
      throw new TransportError('Failed to leave chat', error)
    }
  }

  // --- Interactive ---

  async createPoll(peer: string | bigint, question: string, answers: string[], options?: { isAnonymous?: boolean, multipleChoice?: boolean }): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, question, answerCount: answers.length }, 'Creating poll')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaPoll({
            poll: new Api.Poll({
              id: generateRandomLong(),
              question: new Api.TextWithEntities({ text: question, entities: [] }),
              answers: answers.map((a, i) => new Api.PollAnswer({
                text: new Api.TextWithEntities({ text: a, entities: [] }),
                option: Buffer.from([i]),
              })),
              publicVoters: options?.isAnonymous === false ? true : undefined,
              multipleChoice: options?.multipleChoice,
            }),
          }),
          message: '',
          randomId: generateRandomLong(),
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      this.logger.debug({ messageId: msg.id }, 'Poll created')
      return messageToResult(msg)
    }
    catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to create poll')
      throw new TransportError('Failed to create poll', error)
    }
  }

  async answerCallbackQuery(queryId: string, options?: { text?: string, showAlert?: boolean, url?: string }): Promise<boolean> {
    try {
      this.logger.debug({ queryId }, 'Answering callback query')
      await this.client.invoke(
        new Api.messages.SetBotCallbackAnswer({
          queryId: returnBigInt(queryId),
          message: options?.text,
          alert: options?.showAlert,
          url: options?.url,
        }),
      )
      this.logger.debug({ queryId }, 'Callback query answered')
      return true
    }
    catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer callback query')
      throw new TransportError('Failed to answer callback query', error)
    }
  }

  // --- Helper ---

  // --- SP2: Inline & Payments ---

  async answerInlineQuery(queryId: string, results: unknown[], options?: { cacheTime?: number }): Promise<boolean> {
    try {
      this.logger.debug({ queryId, resultCount: results.length }, 'Answering inline query')
      await this.client.invoke(
        new Api.messages.SetInlineBotResults({
          queryId: returnBigInt(queryId),
          results: [], // GramJS inline result conversion needed per result type
          cacheTime: options?.cacheTime ?? 300,
        }),
      )
      return true
    } catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer inline query')
      throw new TransportError('Failed to answer inline query', error)
    }
  }

  async sendInvoice(peer: string | bigint, params: { title: string, description: string, payload: string, currency: string, prices: Array<{ label: string, amount: number }> }): Promise<MessageResult> {
    try {
      this.logger.debug({ peer, title: params.title }, 'Sending invoice')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.messages.SendMedia({
          peer: entity,
          media: new Api.InputMediaInvoice({
            title: params.title,
            description: params.description,
            payload: Buffer.from(params.payload),
            invoice: new Api.Invoice({
              currency: params.currency,
              prices: params.prices.map((p) => new Api.LabeledPrice({ label: p.label, amount: returnBigInt(p.amount) })),
            }),
            provider: '',
            providerData: new Api.DataJSON({ data: '{}' }),
          }),
          randomId: generateRandomLong(),
          message: '',
        }),
      )
      const msg = this.extractMessageFromUpdates(result)
      return { id: msg.id, date: msg.date, peerId: peer }
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send invoice')
      throw new TransportError('Failed to send invoice', error)
    }
  }

  async answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string): Promise<boolean> {
    try {
      this.logger.debug({ queryId, ok }, 'Answering pre-checkout query')
      await this.client.invoke(
        new Api.messages.SetBotPrecheckoutResults({
          queryId: returnBigInt(queryId),
          success: ok ? true : undefined,
          error: ok ? undefined : errorMessage,
        }),
      )
      return true
    } catch (error) {
      this.logger.error({ err: error, queryId }, 'Failed to answer pre-checkout query')
      throw new TransportError('Failed to answer pre-checkout query', error)
    }
  }

  // --- SP2: Bot configuration ---

  async setChatMenuButton(_peer: string | bigint, _menuButton: { type: string, text?: string, url?: string }): Promise<boolean> {
    // Bot API only feature — MTProto equivalent requires Bot API method forwarding
    this.logger.warn('setChatMenuButton is only available via Bot API, not MTProto')
    return false
  }

  async setMyCommands(commands: Array<{ command: string, description: string }>, _scope?: unknown): Promise<boolean> {
    try {
      this.logger.debug({ commandCount: commands.length }, 'Setting bot commands')
      await this.client.invoke(
        new Api.bots.SetBotCommands({
          scope: new Api.BotCommandScopeDefault(),
          langCode: '',
          commands: commands.map((c) => new Api.BotCommand({ command: c.command, description: c.description })),
        }),
      )
      return true
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to set bot commands')
      throw new TransportError('Failed to set bot commands', error)
    }
  }

  // --- SP2: Media & Forum ---

  async sendMediaGroup(peer: string | bigint, media: Array<{ type: string, url: string, caption?: string }>): Promise<MessageResult[]> {
    try {
      this.logger.debug({ peer, mediaCount: media.length }, 'Sending media group')
      // For now, send each media individually — proper multi-media requires InputMediaUploadedPhoto/Document
      const results: MessageResult[] = []
      for (const item of media) {
        let result: MessageResult
        if (item.type === 'photo') {
          result = await this.sendPhoto(peer, item.url, { caption: item.caption })
        } else if (item.type === 'video') {
          result = await this.sendVideo(peer, item.url, { caption: item.caption })
        } else {
          result = await this.sendDocument(peer, item.url, { caption: item.caption })
        }
        results.push(result)
      }
      return results
    } catch (error) {
      this.logger.error({ err: error, peer }, 'Failed to send media group')
      throw new TransportError('Failed to send media group', error)
    }
  }

  async createForumTopic(peer: string | bigint, name: string, options?: { iconColor?: number, iconEmojiId?: string }): Promise<number> {
    try {
      this.logger.debug({ peer, name }, 'Creating forum topic')
      const entity = await this.client.getInputEntity(toEntityLike(peer))
      const result = await this.client.invoke(
        new Api.channels.CreateForumTopic({
          channel: entity,
          title: name,
          iconColor: options?.iconColor,
          iconEmojiId: options?.iconEmojiId ? returnBigInt(options.iconEmojiId) : undefined,
          randomId: Number(generateRandomLong() % BigInt(2147483647)),
        }),
      )
      // Extract topic ID from result
      if (result instanceof Api.Updates || result instanceof Api.UpdatesCombined) {
        for (const update of result.updates) {
          if (update instanceof Api.UpdateNewChannelMessage && update.message instanceof Api.Message) {
            return update.message.id
          }
        }
      }
      return 0
    } catch (error) {
      this.logger.error({ err: error, peer, name }, 'Failed to create forum topic')
      throw new TransportError('Failed to create forum topic', error)
    }
  }

  private extractMessageFromUpdates(updates: Api.TypeUpdates): Api.Message {
    if (updates instanceof Api.Updates || updates instanceof Api.UpdatesCombined) {
      for (const update of updates.updates) {
        if (update instanceof Api.UpdateNewMessage || update instanceof Api.UpdateNewChannelMessage) {
          if (update.message instanceof Api.Message) {
            return update.message
          }
        }
      }
    }
    if (updates instanceof Api.UpdateShortSentMessage) {
      return new Api.Message({
        id: updates.id,
        peerId: new Api.PeerUser({ userId: returnBigInt(0) }),
        date: updates.date,
        message: '',
      })
    }
    throw new TransportError('Could not extract message from updates')
  }
}
