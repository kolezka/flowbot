import type { ForwardOptions, ITelegramTransport, MessageResult, PeerInfo, SendOptions } from './ITelegramTransport.js'

export interface SentMessage {
  peer: string | bigint
  text: string
  options?: SendOptions
  result: MessageResult
}

export interface ForwardedMessage {
  fromPeer: string | bigint
  toPeer: string | bigint
  messageIds: number[]
  options?: ForwardOptions
  results: MessageResult[]
}

export class FakeTelegramTransport implements ITelegramTransport {
  private connected = false
  private nextId = 1
  private sentMessages: SentMessage[] = []
  private forwardedMessages: ForwardedMessage[] = []

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult> {
    const result: MessageResult = {
      id: this.nextId++,
      date: Math.floor(Date.now() / 1000),
      peerId: peer,
    }
    this.sentMessages.push({ peer, text, options, result })
    return result
  }

  async forwardMessage(fromPeer: string | bigint, toPeer: string | bigint, messageIds: number[], options?: ForwardOptions): Promise<MessageResult[]> {
    const results: MessageResult[] = messageIds.map(_msgId => ({
      id: this.nextId++,
      date: Math.floor(Date.now() / 1000),
      peerId: toPeer,
    }))
    this.forwardedMessages.push({ fromPeer, toPeer, messageIds, options, results })
    return results
  }

  async resolveUsername(username: string): Promise<PeerInfo> {
    return {
      id: BigInt(username.length * 1000),
      accessHash: BigInt(username.length * 9999),
      type: 'user',
    }
  }

  getSentMessages(): readonly SentMessage[] {
    return this.sentMessages
  }

  getForwardedMessages(): readonly ForwardedMessage[] {
    return this.forwardedMessages
  }

  clear(): void {
    this.sentMessages = []
    this.forwardedMessages = []
    this.nextId = 1
  }
}
