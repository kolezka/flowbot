import type { Bot } from 'grammy'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface TelegramMessageResult {
  messageId: number
}

export interface TelegramChatMemberResult {
  userId: number
  status: string
}

export interface TelegramChatResult {
  id: number
  type: string
  title?: string
  username?: string
  description?: string
}

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

export type TelegramParseMode = 'HTML' | 'MarkdownV2'

export interface TelegramSendMessageOptions {
  parseMode?: TelegramParseMode
  disableNotification?: boolean
  replyToMessageId?: number
}

export interface TelegramSendMediaOptions {
  caption?: string
  parseMode?: TelegramParseMode
}

export interface TelegramRestrictOptions {
  canSendMessages?: boolean
  canSendOther?: boolean
  canAddWebPagePreviews?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
  untilDate?: number
}

export interface TelegramPromoteOptions {
  canManageChat?: boolean
  canDeleteMessages?: boolean
  canManageVideoChats?: boolean
  canRestrictMembers?: boolean
  canPromoteMembers?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
}

export interface TelegramPollOptions {
  isAnonymous?: boolean
  allowsMultipleAnswers?: boolean
  pollType?: 'regular' | 'quiz'
}

// ---------------------------------------------------------------------------
// Transport interface
// ---------------------------------------------------------------------------

export interface ITelegramBotTransport {
  // --- Lifecycle ---
  start(): Promise<void>
  stop(): Promise<void>
  isRunning(): boolean
  /** Access the underlying grammY Bot instance for advanced operations. */
  getBot(): Bot

  // --- Messaging ---
  sendMessage(chatId: string, text: string, opts?: TelegramSendMessageOptions): Promise<TelegramMessageResult>
  sendPhoto(chatId: string, photoUrl: string, opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult>
  sendVideo(chatId: string, videoUrl: string, opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult>
  sendDocument(chatId: string, documentUrl: string, opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult>
  sendAudio(chatId: string, audioUrl: string, opts?: TelegramSendMediaOptions): Promise<TelegramMessageResult>
  sendVoice(chatId: string, voiceUrl: string, opts?: Pick<TelegramSendMediaOptions, 'caption'>): Promise<TelegramMessageResult>
  sendSticker(chatId: string, sticker: string): Promise<TelegramMessageResult>
  sendLocation(chatId: string, latitude: number, longitude: number): Promise<TelegramMessageResult>
  sendContact(chatId: string, phoneNumber: string, firstName: string, lastName?: string): Promise<TelegramMessageResult>
  sendPoll(chatId: string, question: string, options: string[], opts?: TelegramPollOptions): Promise<TelegramMessageResult>

  // --- Edit / Delete ---
  editMessage(chatId: string, messageId: number, text: string, opts?: Pick<TelegramSendMessageOptions, 'parseMode'>): Promise<void>
  deleteMessage(chatId: string, messageId: number): Promise<void>

  // --- Pin ---
  pinMessage(chatId: string, messageId: number, disableNotification?: boolean): Promise<void>
  unpinMessage(chatId: string, messageId?: number): Promise<void>

  // --- Reply ---
  replyToMessage(chatId: string, messageId: number, text: string, opts?: Pick<TelegramSendMessageOptions, 'parseMode' | 'disableNotification'>): Promise<TelegramMessageResult>

  // --- Admin ---
  banUser(chatId: string, userId: number): Promise<void>
  unbanUser(chatId: string, userId: number): Promise<void>
  restrictUser(chatId: string, userId: number, opts?: TelegramRestrictOptions): Promise<void>
  promoteUser(chatId: string, userId: number, opts?: TelegramPromoteOptions): Promise<void>

  // --- Chat info ---
  getChat(chatId: string): Promise<TelegramChatResult>
  getChatMember(chatId: string, userId: number): Promise<TelegramChatMemberResult>
  getChatMembersCount(chatId: string): Promise<number>
  setChatTitle(chatId: string, title: string): Promise<void>
  setChatDescription(chatId: string, description: string): Promise<void>
}
