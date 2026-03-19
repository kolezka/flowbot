export type { Logger } from './logger.js'
export { WhatsAppTransportError } from './transport/errors.js'
export { type IWhatsAppTransport } from './transport/IWhatsAppTransport.js'
export type {
  WhatsAppMessageKey,
  WhatsAppMessageResult,
  WhatsAppSendOptions,
  WhatsAppMediaType,
  WhatsAppMediaOptions,
  WhatsAppGroupMetadata,
  WhatsAppGroupParticipant,
  WhatsAppContact,
  WhatsAppPresenceType,
} from './transport/IWhatsAppTransport.js'
export { FakeWhatsAppTransport } from './transport/FakeWhatsAppTransport.js'
export type { SentWhatsAppMessage, DeletedWhatsAppMessage, KickedParticipant } from './transport/FakeWhatsAppTransport.js'
export { CircuitBreaker, CircuitState, CircuitOpenError } from './transport/CircuitBreaker.js'
export type { CircuitBreakerConfig } from './transport/CircuitBreaker.js'
export { createDbAuthState } from './transport/auth-state.js'
export type { AuthState, AuthStateKeys, DbAuthStateResult } from './transport/auth-state.js'
