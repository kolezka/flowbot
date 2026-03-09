import type { EntityLike } from 'telegram/define'

import type { StringSession } from 'telegram/sessions/index.js'
import type { Logger } from '../logger.js'
import type { ForwardOptions, ITelegramTransport, MessageResult, PeerInfo, SendOptions } from './ITelegramTransport.js'
import { TelegramClient } from 'telegram'

import { Api } from 'telegram/tl/index.js'
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
}
