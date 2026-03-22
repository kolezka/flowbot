// SDK layer
export type { ITelegramUserTransport, MessageResult, PeerInfo, SendOptions, ForwardOptions, MediaOptions, ChatPermissions, AdminPrivileges, ChatMemberInfo } from './sdk/types.js'
export { GramJsClient } from './sdk/gramjs-client.js'
export type { GramJsClientConfig } from './sdk/gramjs-client.js'
export { FakeTelegramUserTransport } from './sdk/fake-client.js'
export type { SentMessage, ForwardedMessage } from './sdk/fake-client.js'

// Connector
export { TelegramUserConnector } from './connector.js'
export type { TelegramUserConnectorConfig } from './connector.js'

// Action registrars
export { registerMessagingActions } from './actions/messaging.js'
export { registerUserActions } from './actions/user-actions.js'
export { registerFlowActions } from './actions/flow-actions.js'

// Schemas
export {
  sendMessageSchema,
  sendPhotoSchema,
  sendVideoSchema,
  sendDocumentSchema,
  sendStickerSchema,
  sendVoiceSchema,
  sendAudioSchema,
  sendAnimationSchema,
  sendLocationSchema,
  sendContactSchema,
  sendVenueSchema,
  sendDiceSchema,
  forwardMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  unpinMessageSchema,
  copyMessageSchema,
  banUserSchema,
  restrictUserSchema,
  promoteUserSchema,
  setChatTitleSchema,
  setChatDescriptionSchema,
  exportInviteLinkSchema,
  getChatMemberSchema,
  leaveChatSchema,
  createPollSchema,
  sendMediaGroupSchema,
  createForumTopicSchema,
  resolveUsernameSchema,
} from './actions/schemas.js'
