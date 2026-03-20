// SDK layer
export type { ITelegramUserTransport, MessageResult, PeerInfo, SendOptions, ForwardOptions, MediaOptions, ChatPermissions, AdminPrivileges, ChatMemberInfo } from './sdk/types.js'
export { GramJsClient } from './sdk/gramjs-client.js'
export type { GramJsClientConfig } from './sdk/gramjs-client.js'
export { FakeTelegramUserTransport } from './sdk/fake-client.js'
export type { SentMessage, ForwardedMessage } from './sdk/fake-client.js'
