// SDK layer
export type { IDiscordBotTransport } from './sdk/types.js'
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
} from './sdk/types.js'
export { DiscordClient } from './sdk/discord-client.js'
export { FakeDiscordClient } from './sdk/fake-client.js'
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
} from './sdk/fake-client.js'

// Actions
export * from './actions/schemas.js'
export { registerMessagingActions } from './actions/messaging.js'
export { registerAdminActions } from './actions/admin.js'
export { registerChannelActions } from './actions/channel.js'

// Events
export {
  mapMessageEvent,
  mapMemberJoinEvent,
  mapMemberLeaveEvent,
  mapInteractionEvent,
  mapReactionAddEvent,
  mapReactionRemoveEvent,
  mapVoiceStateEvent,
} from './events/mapper.js'
export type {
  DiscordMessageEventData,
  DiscordMemberJoinEventData,
  DiscordMemberLeaveEventData,
  DiscordInteractionEventData,
  DiscordReactionEventData,
  DiscordVoiceStateEventData,
} from './events/mapper.js'
export { registerEventListeners } from './events/listeners.js'

// Connector
export { DiscordBotConnector } from './connector.js'
export type { DiscordBotConnectorConfig } from './connector.js'
