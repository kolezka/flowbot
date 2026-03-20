// SDK layer
export type { IWhatsAppTransport } from './sdk/types.js'
export { FakeWhatsAppTransport } from './sdk/fake-client.js'

// Actions
export * from './actions/schemas.js'
export { registerMessagingActions } from './actions/messaging.js'
export { registerGroupAdminActions } from './actions/group-admin.js'
export { registerMessageMgmtActions } from './actions/message-mgmt.js'
export { registerPresenceActions } from './actions/presence.js'

// Connector
export { WhatsAppUserConnector } from './connector.js'
export type { WhatsAppUserConnectorConfig } from './connector.js'

// Auth
export { setupQrAuth } from './auth.js'
