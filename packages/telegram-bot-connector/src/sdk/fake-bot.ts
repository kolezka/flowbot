import type { Bot } from 'grammy'
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

// ---------------------------------------------------------------------------
// Test spy records
// ---------------------------------------------------------------------------

export interface SentTelegramMessage {
  chatId: string
  text: string
  opts?: TelegramSendMessageOptions
  result: TelegramMessageResult
}

export interface DeletedTelegramMessage {
  chatId: string
  messageId: number
}

export interface BannedUser {
  chatId: string
  userId: number
}

export interface RestrictedUser {
  chatId: string
  userId: number
  opts?: TelegramRestrictOptions
}

// ---------------------------------------------------------------------------
// Fake implementation
// ---------------------------------------------------------------------------

/**
 * In-memory test double for ITelegramBotTransport.
 * Records all calls so tests can assert on them.
 */
export class FakeTelegramBot implements ITelegramBotTransport {
  private _running = false
  private nextId = 1
  private sentMessages: SentTelegramMessage[] = []
  private deletedMessages: DeletedTelegramMessage[] = []
  private bannedUsers: BannedUser[] = []
  private restrictedUsers: RestrictedUser[] = []

  private makeResult(): TelegramMessageResult {
    return { messageId: this.nextId++ }
  }

  // --- Lifecycle ---

  async start(): Promise<void> {
    this._running = true
  }

  async stop(): Promise<void> {
    this._running = false
  }

  isRunning(): boolean {
    return this._running
  }

  getBot(): Bot {
    // Return a stub with no-op middleware methods so features/events can register without crashing
    const stub = new Proxy({} as Bot, {
      get: () => () => stub,
    })
    return stub
  }

  // --- Messaging ---

  async sendMessage(
    chatId: string,
    text: string,
    opts?: TelegramSendMessageOptions,
  ): Promise<TelegramMessageResult> {
    const result = this.makeResult()
    this.sentMessages.push({ chatId, text, opts, result })
    return result
  }

  async sendPhoto(chatId: string, _photoUrl: string, _opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendVideo(chatId: string, _videoUrl: string, _opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendDocument(chatId: string, _documentUrl: string, _opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendAudio(chatId: string, _audioUrl: string, _opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendVoice(chatId: string, _voiceUrl: string, _opts?: Pick<TelegramSendMediaOptions, 'caption'>): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendSticker(chatId: string, _sticker: string): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendLocation(chatId: string, _latitude: number, _longitude: number): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendContact(chatId: string, _phoneNumber: string, _firstName: string, _lastName?: string): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  async sendPoll(chatId: string, _question: string, _options: string[], _opts?: TelegramPollOptions): Promise<TelegramMessageResult> {
    return this.makeResult()
  }

  // --- Edit / Delete ---

  async editMessage(_chatId: string, _messageId: number, _text: string, _opts?: Pick<TelegramSendMessageOptions, 'parseMode'>): Promise<void> {
    // no-op in fake
  }

  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    this.deletedMessages.push({ chatId, messageId })
  }

  // --- Pin ---

  async pinMessage(_chatId: string, _messageId: number, _disableNotification?: boolean): Promise<void> {
    // no-op in fake
  }

  async unpinMessage(_chatId: string, _messageId?: number): Promise<void> {
    // no-op in fake
  }

  // --- Reply ---

  async replyToMessage(
    chatId: string,
    _messageId: number,
    text: string,
    opts?: Pick<TelegramSendMessageOptions, 'parseMode' | 'disableNotification'>,
  ): Promise<TelegramMessageResult> {
    const result = this.makeResult()
    this.sentMessages.push({ chatId, text, opts, result })
    return result
  }

  // --- Admin ---

  async banUser(chatId: string, userId: number): Promise<void> {
    this.bannedUsers.push({ chatId, userId })
  }

  async unbanUser(_chatId: string, _userId: number): Promise<void> {
    // no-op in fake
  }

  async restrictUser(chatId: string, userId: number, opts?: TelegramRestrictOptions): Promise<void> {
    this.restrictedUsers.push({ chatId, userId, opts })
  }

  async promoteUser(_chatId: string, _userId: number, _opts?: TelegramPromoteOptions): Promise<void> {
    // no-op in fake
  }

  // --- Chat info ---

  async getChat(chatId: string): Promise<TelegramChatResult> {
    return {
      id: Number(chatId) || -1001234567890,
      type: 'supergroup',
      title: 'Fake Group',
    }
  }

  async getChatMember(chatId: string, userId: number): Promise<TelegramChatMemberResult> {
    return { userId, status: 'member' }
  }

  async getChatMembersCount(_chatId: string): Promise<number> {
    return 42
  }

  async setChatTitle(_chatId: string, _title: string): Promise<void> {
    // no-op in fake
  }

  async setChatDescription(_chatId: string, _description: string): Promise<void> {
    // no-op in fake
  }

  // --- Test helpers ---

  getSentMessages(): readonly SentTelegramMessage[] {
    return this.sentMessages
  }

  getDeletedMessages(): readonly DeletedTelegramMessage[] {
    return this.deletedMessages
  }

  getBannedUsers(): readonly BannedUser[] {
    return this.bannedUsers
  }

  getRestrictedUsers(): readonly RestrictedUser[] {
    return this.restrictedUsers
  }

  clear(): void {
    this.sentMessages = []
    this.deletedMessages = []
    this.bannedUsers = []
    this.restrictedUsers = []
    this.nextId = 1
  }
}
