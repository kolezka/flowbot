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

export interface ITelegramTransport {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendMessage: (peer: string | bigint, text: string, options?: SendOptions) => Promise<MessageResult>
  forwardMessage: (fromPeer: string | bigint, toPeer: string | bigint, messageIds: number[], options?: ForwardOptions) => Promise<MessageResult[]>
  resolveUsername: (username: string) => Promise<PeerInfo>
  isConnected: () => boolean
}
