// Logger type
export type { Logger } from './logger.js'

// Transport layer
export { type ITelegramTransport } from './transport/ITelegramTransport.js'
export type { MessageResult, PeerInfo, SendOptions, ForwardOptions, MediaOptions, ChatPermissions, AdminPrivileges, ChatMemberInfo } from './transport/ITelegramTransport.js'
export { GramJsTransport } from './transport/GramJsTransport.js'
export { FakeTelegramTransport } from './transport/FakeTelegramTransport.js'
export { CircuitBreaker } from './transport/CircuitBreaker.js'
export { TransportError } from './transport/errors.js'

// Error handling
export { classifyError, ErrorCategory } from './errors/classifier.js'
export { calculateBackoff, sleep } from './errors/backoff.js'

// Action system
export { ActionType } from './actions/types.js'
export type {
  Action,
  SendMessagePayload,
  ForwardMessagePayload,
  BroadcastPayload,
  CrossPostPayload,
  SendWelcomeDmPayload,
} from './actions/types.js'
export { ActionRunner } from './actions/runner.js'
export type { ActionResult } from './actions/runner.js'

// Executors
export { executeBroadcast } from './actions/executors/broadcast.js'
export { executeCrossPost } from './actions/executors/cross-post.js'
export { executeForwardMessage } from './actions/executors/forward-message.js'
export { executeSendMessage } from './actions/executors/send-message.js'
export { executeSendWelcomeDm } from './actions/executors/send-welcome-dm.js'
