export interface MessageResult {
  id: number
  date: number
  peerId: string | bigint
}

export interface PeerInfo {
  id: bigint
  accessHash: bigint
  type: 'user' | 'chat' | 'channel'
}

export interface SendOptions {
  parseMode?: 'html' | 'markdown'
  replyToMsgId?: number
  silent?: boolean
}

export interface ForwardOptions {
  silent?: boolean
  dropAuthor?: boolean
}

export interface MediaOptions {
  caption?: string
  parseMode?: 'html' | 'markdown'
  silent?: boolean
  replyToMsgId?: number
  fileName?: string
}

export interface ChatPermissions {
  canSendMessages?: boolean
  canSendMedia?: boolean
  canSendPolls?: boolean
  canSendOther?: boolean
  canAddWebPagePreviews?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
}

export interface AdminPrivileges {
  canManageChat?: boolean
  canDeleteMessages?: boolean
  canManageVideoChats?: boolean
  canRestrictMembers?: boolean
  canPromoteMembers?: boolean
  canChangeInfo?: boolean
  canInviteUsers?: boolean
  canPinMessages?: boolean
}

export interface ChatMemberInfo {
  userId: string
  status: string
  permissions?: Record<string, boolean>
}

export interface ITelegramTransport {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendMessage: (peer: string | bigint, text: string, options?: SendOptions) => Promise<MessageResult>
  forwardMessage: (fromPeer: string | bigint, toPeer: string | bigint, messageIds: number[], options?: ForwardOptions) => Promise<MessageResult[]>
  resolveUsername: (username: string) => Promise<PeerInfo>
  isConnected: () => boolean

  // Media messaging
  sendPhoto: (peer: string | bigint, photoUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendVideo: (peer: string | bigint, videoUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendDocument: (peer: string | bigint, documentUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendSticker: (peer: string | bigint, sticker: string, options?: { silent?: boolean }) => Promise<MessageResult>
  sendVoice: (peer: string | bigint, voiceUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendAudio: (peer: string | bigint, audioUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendAnimation: (peer: string | bigint, animationUrl: string, options?: MediaOptions) => Promise<MessageResult>
  sendLocation: (peer: string | bigint, latitude: number, longitude: number, options?: { livePeriod?: number, silent?: boolean }) => Promise<MessageResult>
  sendContact: (peer: string | bigint, phoneNumber: string, firstName: string, lastName?: string) => Promise<MessageResult>
  sendVenue: (peer: string | bigint, latitude: number, longitude: number, title: string, address: string) => Promise<MessageResult>
  sendDice: (peer: string | bigint, emoji?: string) => Promise<MessageResult>

  // Message management
  copyMessage: (fromPeer: string | bigint, toPeer: string | bigint, messageId: number) => Promise<MessageResult[]>
  editMessage: (peer: string | bigint, messageId: number, text: string, options?: SendOptions) => Promise<MessageResult>
  deleteMessages: (peer: string | bigint, messageIds: number[]) => Promise<boolean>
  pinMessage: (peer: string | bigint, messageId: number, silent?: boolean) => Promise<boolean>
  unpinMessage: (peer: string | bigint, messageId?: number) => Promise<boolean>

  // User management
  banUser: (peer: string | bigint, userId: string | bigint) => Promise<boolean>
  restrictUser: (peer: string | bigint, userId: string | bigint, permissions: ChatPermissions, untilDate?: number) => Promise<boolean>
  promoteUser: (peer: string | bigint, userId: string | bigint, privileges: AdminPrivileges) => Promise<boolean>

  // Chat management
  setChatTitle: (peer: string | bigint, title: string) => Promise<boolean>
  setChatDescription: (peer: string | bigint, description: string) => Promise<boolean>
  exportInviteLink: (peer: string | bigint) => Promise<string>
  getChatMember: (peer: string | bigint, userId: string | bigint) => Promise<ChatMemberInfo>
  leaveChat: (peer: string | bigint) => Promise<boolean>

  // Interactive
  createPoll: (peer: string | bigint, question: string, answers: string[], options?: { isAnonymous?: boolean, multipleChoice?: boolean }) => Promise<MessageResult>
  answerCallbackQuery: (queryId: string, options?: { text?: string, showAlert?: boolean, url?: string }) => Promise<boolean>

  // Inline & Payments (SP2)
  answerInlineQuery: (queryId: string, results: unknown[], options?: { cacheTime?: number }) => Promise<boolean>
  sendInvoice: (peer: string | bigint, params: { title: string, description: string, payload: string, currency: string, prices: Array<{ label: string, amount: number }> }) => Promise<MessageResult>
  answerPreCheckoutQuery: (queryId: string, ok: boolean, errorMessage?: string) => Promise<boolean>

  // Bot configuration (SP2)
  setChatMenuButton: (peer: string | bigint, menuButton: { type: string, text?: string, url?: string }) => Promise<boolean>
  setMyCommands: (commands: Array<{ command: string, description: string }>, scope?: unknown) => Promise<boolean>

  // Media & Forum (SP2)
  sendMediaGroup: (peer: string | bigint, media: Array<{ type: string, url: string, caption?: string }>) => Promise<MessageResult[]>
  createForumTopic: (peer: string | bigint, name: string, options?: { iconColor?: number, iconEmojiId?: string }) => Promise<number>
}
