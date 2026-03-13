// Transport layer
export { type IDiscordTransport } from './transport/IDiscordTransport.js'
export type {
  DiscordMessageResult,
  DiscordMessageOptions,
  DiscordEmbedData,
  DiscordChannelType,
  DiscordChannelOptions,
  DiscordThreadOptions,
  DiscordRoleOptions,
  DiscordInviteOptions,
  DiscordScheduledEventOptions,
} from './transport/IDiscordTransport.js'
export { DiscordJsTransport } from './transport/DiscordJsTransport.js'
export { FakeDiscordTransport } from './transport/FakeDiscordTransport.js'
export type {
  SentMessage,
  SentEmbed,
  SentDM,
  EditedMessage,
  DeletedMessage,
  PinnedMessage,
  Reaction,
  BannedMember,
  KickedMember,
  TimedOutMember,
  RoleChange,
  NicknameChange,
  CreatedChannel,
  CreatedThread,
  CreatedRole,
  CreatedInvite,
  MovedMember,
  CreatedEvent,
} from './transport/FakeDiscordTransport.js'
export { CircuitBreaker, CircuitState, CircuitOpenError } from './transport/CircuitBreaker.js'
export type { CircuitBreakerConfig } from './transport/CircuitBreaker.js'
export { TransportError } from './transport/errors.js'
