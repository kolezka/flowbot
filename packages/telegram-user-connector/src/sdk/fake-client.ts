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

/**
 * In-memory test double implementing ITelegramUserTransport.
 * Records sent/forwarded messages for assertion in unit tests.
 */
export class FakeTelegramUserTransport implements ITelegramUserTransport {
  private connected = false
  private nextId = 1
  private sentMessages: SentMessage[] = []
  private forwardedMessages: ForwardedMessage[] = []

  private makeResult(peer: string | bigint): MessageResult {
    return {
      id: this.nextId++,
      date: Math.floor(Date.now() / 1000),
      peerId: peer,
    }
  }

  // --- Connection ---

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  getClient(): unknown {
    return null
  }

  // --- Messaging ---

  async sendMessage(peer: string | bigint, text: string, options?: SendOptions): Promise<MessageResult> {
    const result = this.makeResult(peer)
    this.sentMessages.push({ peer, text, options, result })
    return result
  }

  async forwardMessage(fromPeer: string | bigint, toPeer: string | bigint, messageIds: number[], options?: ForwardOptions): Promise<MessageResult[]> {
    const results: MessageResult[] = messageIds.map(() => this.makeResult(toPeer))
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

  // --- Media messaging ---

  async sendPhoto(peer: string | bigint, _photoUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendVideo(peer: string | bigint, _videoUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendDocument(peer: string | bigint, _documentUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendSticker(peer: string | bigint, _sticker: string, _options?: { silent?: boolean }): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendVoice(peer: string | bigint, _voiceUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendAudio(peer: string | bigint, _audioUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendAnimation(peer: string | bigint, _animationUrl: string, _options?: MediaOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendLocation(peer: string | bigint, _latitude: number, _longitude: number, _options?: { livePeriod?: number; silent?: boolean }): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendContact(peer: string | bigint, _phoneNumber: string, _firstName: string, _lastName?: string): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendVenue(peer: string | bigint, _latitude: number, _longitude: number, _title: string, _address: string): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async sendDice(peer: string | bigint, _emoji?: string): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  // --- Message management ---

  async copyMessage(_fromPeer: string | bigint, toPeer: string | bigint, _messageId: number): Promise<MessageResult[]> {
    return [this.makeResult(toPeer)]
  }

  async editMessage(peer: string | bigint, _messageId: number, _text: string, _options?: SendOptions): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async deleteMessages(_peer: string | bigint, _messageIds: number[]): Promise<boolean> {
    return true
  }

  async pinMessage(_peer: string | bigint, _messageId: number, _silent?: boolean): Promise<boolean> {
    return true
  }

  async unpinMessage(_peer: string | bigint, _messageId?: number): Promise<boolean> {
    return true
  }

  // --- User management ---

  async banUser(_peer: string | bigint, _userId: string | bigint): Promise<boolean> {
    return true
  }

  async restrictUser(_peer: string | bigint, _userId: string | bigint, _permissions: ChatPermissions, _untilDate?: number): Promise<boolean> {
    return true
  }

  async promoteUser(_peer: string | bigint, _userId: string | bigint, _privileges: AdminPrivileges): Promise<boolean> {
    return true
  }

  // --- Chat management ---

  async setChatTitle(_peer: string | bigint, _title: string): Promise<boolean> {
    return true
  }

  async setChatDescription(_peer: string | bigint, _description: string): Promise<boolean> {
    return true
  }

  async exportInviteLink(_peer: string | bigint): Promise<string> {
    return 'https://t.me/+fake_invite_link'
  }

  async getChatMember(_peer: string | bigint, userId: string | bigint): Promise<ChatMemberInfo> {
    return { userId: String(userId), status: 'member' }
  }

  async leaveChat(_peer: string | bigint): Promise<boolean> {
    return true
  }

  // --- Interactive ---

  async createPoll(peer: string | bigint, _question: string, _answers: string[], _options?: { isAnonymous?: boolean; multipleChoice?: boolean }): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async answerCallbackQuery(_queryId: string, _options?: { text?: string; showAlert?: boolean; url?: string }): Promise<boolean> {
    return true
  }

  // --- Inline & Payments ---

  async answerInlineQuery(_queryId: string, _results: unknown[], _options?: { cacheTime?: number }): Promise<boolean> {
    return true
  }

  async sendInvoice(peer: string | bigint, _params: { title: string; description: string; payload: string; currency: string; prices: Array<{ label: string; amount: number }> }): Promise<MessageResult> {
    return this.makeResult(peer)
  }

  async answerPreCheckoutQuery(_queryId: string, _ok: boolean, _errorMessage?: string): Promise<boolean> {
    return true
  }

  // --- Bot configuration ---

  async setChatMenuButton(_peer: string | bigint, _menuButton: { type: string; text?: string; url?: string }): Promise<boolean> {
    return true
  }

  async setMyCommands(_commands: Array<{ command: string; description: string }>, _scope?: unknown): Promise<boolean> {
    return true
  }

  // --- Media & Forum ---

  async sendMediaGroup(peer: string | bigint, media: Array<{ type: string; url: string; caption?: string }>): Promise<MessageResult[]> {
    return media.map(() => this.makeResult(peer))
  }

  async createForumTopic(_peer: string | bigint, _name: string, _options?: { iconColor?: number; iconEmojiId?: string }): Promise<number> {
    return this.nextId++
  }

  // --- Test helpers ---

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
