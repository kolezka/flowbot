export enum FlowNodeType {
  // =====================
  // Telegram Triggers
  // =====================
  MESSAGE_RECEIVED = 'message_received',
  USER_JOINS = 'user_joins',
  USER_LEAVES = 'user_leaves',
  CALLBACK_QUERY = 'callback_query',
  COMMAND_RECEIVED = 'command_received',
  MESSAGE_EDITED = 'message_edited',
  CHAT_MEMBER_UPDATED = 'chat_member_updated',
  POLL_ANSWER = 'poll_answer',
  INLINE_QUERY = 'inline_query',
  MY_CHAT_MEMBER = 'my_chat_member',
  NEW_CHAT_TITLE = 'new_chat_title',
  NEW_CHAT_PHOTO = 'new_chat_photo',
  SCHEDULE = 'schedule',
  WEBHOOK = 'webhook',

  // =====================
  // Telegram Conditions
  // =====================
  KEYWORD_MATCH = 'keyword_match',
  USER_ROLE = 'user_role',
  TIME_BASED = 'time_based',
  MESSAGE_TYPE = 'message_type',
  CHAT_TYPE = 'chat_type',
  REGEX_MATCH = 'regex_match',
  HAS_MEDIA = 'has_media',
  USER_IS_ADMIN = 'user_is_admin',
  MESSAGE_LENGTH = 'message_length',
  CALLBACK_DATA_MATCH = 'callback_data_match',
  USER_IS_BOT = 'user_is_bot',

  // =====================
  // Telegram Actions
  // =====================
  SEND_MESSAGE = 'send_message',
  SEND_PHOTO = 'send_photo',
  FORWARD_MESSAGE = 'forward_message',
  COPY_MESSAGE = 'copy_message',
  EDIT_MESSAGE = 'edit_message',
  DELETE_MESSAGE = 'delete_message',
  PIN_MESSAGE = 'pin_message',
  UNPIN_MESSAGE = 'unpin_message',
  BAN_USER = 'ban_user',
  MUTE_USER = 'mute_user',
  RESTRICT_USER = 'restrict_user',
  PROMOTE_USER = 'promote_user',
  CREATE_POLL = 'create_poll',
  ANSWER_CALLBACK_QUERY = 'answer_callback_query',
  SEND_VIDEO = 'send_video',
  SEND_DOCUMENT = 'send_document',
  SEND_STICKER = 'send_sticker',
  SEND_LOCATION = 'send_location',
  SEND_VOICE = 'send_voice',
  SEND_CONTACT = 'send_contact',
  SET_CHAT_TITLE = 'set_chat_title',
  SET_CHAT_DESCRIPTION = 'set_chat_description',
  EXPORT_INVITE_LINK = 'export_invite_link',
  GET_CHAT_MEMBER = 'get_chat_member',
  SEND_ANIMATION = 'send_animation',
  SEND_VENUE = 'send_venue',
  SEND_DICE = 'send_dice',
  SEND_MEDIA_GROUP = 'send_media_group',
  SEND_AUDIO = 'send_audio',
  LEAVE_CHAT = 'leave_chat',
  GET_CHAT_INFO = 'get_chat_info',
  SET_CHAT_PHOTO = 'set_chat_photo',
  DELETE_CHAT_PHOTO = 'delete_chat_photo',
  APPROVE_JOIN_REQUEST = 'approve_join_request',
  BOT_ACTION = 'bot_action',
  API_CALL = 'api_call',
  DELAY = 'delay',

  // =====================
  // Discord Triggers
  // =====================
  DISCORD_MESSAGE_RECEIVED = 'discord_message_received',
  DISCORD_MEMBER_JOIN = 'discord_member_join',
  DISCORD_MEMBER_LEAVE = 'discord_member_leave',
  DISCORD_REACTION_ADD = 'discord_reaction_add',
  DISCORD_REACTION_REMOVE = 'discord_reaction_remove',
  DISCORD_VOICE_STATE_UPDATE = 'discord_voice_state_update',
  DISCORD_INTERACTION_CREATE = 'discord_interaction_create',
  DISCORD_CHANNEL_CREATE = 'discord_channel_create',
  DISCORD_CHANNEL_DELETE = 'discord_channel_delete',
  DISCORD_ROLE_UPDATE = 'discord_role_update',
  DISCORD_SCHEDULED_EVENT = 'discord_scheduled_event',

  // =====================
  // Discord Conditions
  // =====================
  DISCORD_HAS_ROLE = 'discord_has_role',
  DISCORD_CHANNEL_TYPE = 'discord_channel_type',
  DISCORD_IS_BOT = 'discord_is_bot',
  DISCORD_MESSAGE_HAS_EMBED = 'discord_message_has_embed',
  DISCORD_MEMBER_PERMISSIONS = 'discord_member_permissions',

  // =====================
  // Discord Actions
  // =====================
  DISCORD_SEND_MESSAGE = 'discord_send_message',
  DISCORD_SEND_EMBED = 'discord_send_embed',
  DISCORD_SEND_DM = 'discord_send_dm',
  DISCORD_EDIT_MESSAGE = 'discord_edit_message',
  DISCORD_DELETE_MESSAGE = 'discord_delete_message',
  DISCORD_ADD_REACTION = 'discord_add_reaction',
  DISCORD_REMOVE_REACTION = 'discord_remove_reaction',
  DISCORD_PIN_MESSAGE = 'discord_pin_message',
  DISCORD_UNPIN_MESSAGE = 'discord_unpin_message',
  DISCORD_BAN_MEMBER = 'discord_ban_member',
  DISCORD_KICK_MEMBER = 'discord_kick_member',
  DISCORD_TIMEOUT_MEMBER = 'discord_timeout_member',
  DISCORD_ADD_ROLE = 'discord_add_role',
  DISCORD_REMOVE_ROLE = 'discord_remove_role',
  DISCORD_CREATE_ROLE = 'discord_create_role',
  DISCORD_SET_NICKNAME = 'discord_set_nickname',
  DISCORD_CREATE_CHANNEL = 'discord_create_channel',
  DISCORD_DELETE_CHANNEL = 'discord_delete_channel',
  DISCORD_MOVE_MEMBER = 'discord_move_member',
  DISCORD_CREATE_THREAD = 'discord_create_thread',
  DISCORD_SEND_THREAD_MESSAGE = 'discord_send_thread_message',
  DISCORD_CREATE_INVITE = 'discord_create_invite',
  DISCORD_CREATE_SCHEDULED_EVENT = 'discord_create_scheduled_event',
}

export type FlowNodeCategory = 'trigger' | 'condition' | 'action' | 'advanced';

export type FlowPlatform = 'telegram' | 'discord';

export interface FlowNodeConfig {
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  category: FlowNodeCategory;
  label: string;
  position: { x: number; y: number };
  config: FlowNodeConfig;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export type FlowTransportMode = 'mtproto' | 'bot_api' | 'discord_bot' | 'auto';

export interface FlowTransportConfig {
  /** Primary platform for this flow. Default: 'telegram' */
  platform?: FlowPlatform;
  /** Which transport to use for action execution. Default: 'auto' */
  transport: FlowTransportMode;
  /** Bot instance ID (used when transport is 'bot_api', 'discord_bot', or 'auto') */
  botInstanceId?: string;
  /** Discord bot instance ID (for cross-platform flows using both platforms) */
  discordBotInstanceId?: string;
}

export interface FlowDefinitionData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  transportConfig?: FlowTransportConfig;
}

/** Helper: returns the platform for a given node type */
export function getNodePlatform(nodeType: FlowNodeType): FlowPlatform | null {
  if (nodeType.startsWith('discord_')) return 'discord';
  // General-purpose nodes (delay, api_call, webhook, schedule) are platform-agnostic
  const agnostic: FlowNodeType[] = [
    FlowNodeType.SCHEDULE, FlowNodeType.WEBHOOK, FlowNodeType.API_CALL,
    FlowNodeType.DELAY, FlowNodeType.TIME_BASED,
  ];
  if (agnostic.includes(nodeType)) return null;
  return 'telegram';
}

export const NODE_CATEGORIES: Record<FlowNodeType, FlowNodeCategory> = {
  // Triggers
  [FlowNodeType.MESSAGE_RECEIVED]: 'trigger',
  [FlowNodeType.USER_JOINS]: 'trigger',
  [FlowNodeType.USER_LEAVES]: 'trigger',
  [FlowNodeType.CALLBACK_QUERY]: 'trigger',
  [FlowNodeType.COMMAND_RECEIVED]: 'trigger',
  [FlowNodeType.MESSAGE_EDITED]: 'trigger',
  [FlowNodeType.CHAT_MEMBER_UPDATED]: 'trigger',
  [FlowNodeType.POLL_ANSWER]: 'trigger',
  [FlowNodeType.INLINE_QUERY]: 'trigger',
  [FlowNodeType.MY_CHAT_MEMBER]: 'trigger',
  [FlowNodeType.NEW_CHAT_TITLE]: 'trigger',
  [FlowNodeType.NEW_CHAT_PHOTO]: 'trigger',
  [FlowNodeType.SCHEDULE]: 'trigger',
  [FlowNodeType.WEBHOOK]: 'trigger',
  // Conditions
  [FlowNodeType.KEYWORD_MATCH]: 'condition',
  [FlowNodeType.USER_ROLE]: 'condition',
  [FlowNodeType.TIME_BASED]: 'condition',
  [FlowNodeType.MESSAGE_TYPE]: 'condition',
  [FlowNodeType.CHAT_TYPE]: 'condition',
  [FlowNodeType.REGEX_MATCH]: 'condition',
  [FlowNodeType.HAS_MEDIA]: 'condition',
  [FlowNodeType.USER_IS_ADMIN]: 'condition',
  [FlowNodeType.MESSAGE_LENGTH]: 'condition',
  [FlowNodeType.CALLBACK_DATA_MATCH]: 'condition',
  [FlowNodeType.USER_IS_BOT]: 'condition',
  // Actions
  [FlowNodeType.SEND_MESSAGE]: 'action',
  [FlowNodeType.SEND_PHOTO]: 'action',
  [FlowNodeType.FORWARD_MESSAGE]: 'action',
  [FlowNodeType.COPY_MESSAGE]: 'action',
  [FlowNodeType.EDIT_MESSAGE]: 'action',
  [FlowNodeType.DELETE_MESSAGE]: 'action',
  [FlowNodeType.PIN_MESSAGE]: 'action',
  [FlowNodeType.UNPIN_MESSAGE]: 'action',
  [FlowNodeType.BAN_USER]: 'action',
  [FlowNodeType.MUTE_USER]: 'action',
  [FlowNodeType.RESTRICT_USER]: 'action',
  [FlowNodeType.PROMOTE_USER]: 'action',
  [FlowNodeType.CREATE_POLL]: 'action',
  [FlowNodeType.ANSWER_CALLBACK_QUERY]: 'action',
  [FlowNodeType.SEND_VIDEO]: 'action',
  [FlowNodeType.SEND_DOCUMENT]: 'action',
  [FlowNodeType.SEND_STICKER]: 'action',
  [FlowNodeType.SEND_LOCATION]: 'action',
  [FlowNodeType.SEND_VOICE]: 'action',
  [FlowNodeType.SEND_CONTACT]: 'action',
  [FlowNodeType.SET_CHAT_TITLE]: 'action',
  [FlowNodeType.SET_CHAT_DESCRIPTION]: 'action',
  [FlowNodeType.EXPORT_INVITE_LINK]: 'action',
  [FlowNodeType.GET_CHAT_MEMBER]: 'action',
  [FlowNodeType.SEND_ANIMATION]: 'action',
  [FlowNodeType.SEND_VENUE]: 'action',
  [FlowNodeType.SEND_DICE]: 'action',
  [FlowNodeType.SEND_MEDIA_GROUP]: 'action',
  [FlowNodeType.SEND_AUDIO]: 'action',
  [FlowNodeType.LEAVE_CHAT]: 'action',
  [FlowNodeType.GET_CHAT_INFO]: 'action',
  [FlowNodeType.SET_CHAT_PHOTO]: 'action',
  [FlowNodeType.DELETE_CHAT_PHOTO]: 'action',
  [FlowNodeType.APPROVE_JOIN_REQUEST]: 'action',
  [FlowNodeType.BOT_ACTION]: 'action',
  [FlowNodeType.API_CALL]: 'action',
  [FlowNodeType.DELAY]: 'action',
  // Discord Triggers
  [FlowNodeType.DISCORD_MESSAGE_RECEIVED]: 'trigger',
  [FlowNodeType.DISCORD_MEMBER_JOIN]: 'trigger',
  [FlowNodeType.DISCORD_MEMBER_LEAVE]: 'trigger',
  [FlowNodeType.DISCORD_REACTION_ADD]: 'trigger',
  [FlowNodeType.DISCORD_REACTION_REMOVE]: 'trigger',
  [FlowNodeType.DISCORD_VOICE_STATE_UPDATE]: 'trigger',
  [FlowNodeType.DISCORD_INTERACTION_CREATE]: 'trigger',
  [FlowNodeType.DISCORD_CHANNEL_CREATE]: 'trigger',
  [FlowNodeType.DISCORD_CHANNEL_DELETE]: 'trigger',
  [FlowNodeType.DISCORD_ROLE_UPDATE]: 'trigger',
  [FlowNodeType.DISCORD_SCHEDULED_EVENT]: 'trigger',
  // Discord Conditions
  [FlowNodeType.DISCORD_HAS_ROLE]: 'condition',
  [FlowNodeType.DISCORD_CHANNEL_TYPE]: 'condition',
  [FlowNodeType.DISCORD_IS_BOT]: 'condition',
  [FlowNodeType.DISCORD_MESSAGE_HAS_EMBED]: 'condition',
  [FlowNodeType.DISCORD_MEMBER_PERMISSIONS]: 'condition',
  // Discord Actions
  [FlowNodeType.DISCORD_SEND_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_SEND_EMBED]: 'action',
  [FlowNodeType.DISCORD_SEND_DM]: 'action',
  [FlowNodeType.DISCORD_EDIT_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_DELETE_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_ADD_REACTION]: 'action',
  [FlowNodeType.DISCORD_REMOVE_REACTION]: 'action',
  [FlowNodeType.DISCORD_PIN_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_UNPIN_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_BAN_MEMBER]: 'action',
  [FlowNodeType.DISCORD_KICK_MEMBER]: 'action',
  [FlowNodeType.DISCORD_TIMEOUT_MEMBER]: 'action',
  [FlowNodeType.DISCORD_ADD_ROLE]: 'action',
  [FlowNodeType.DISCORD_REMOVE_ROLE]: 'action',
  [FlowNodeType.DISCORD_CREATE_ROLE]: 'action',
  [FlowNodeType.DISCORD_SET_NICKNAME]: 'action',
  [FlowNodeType.DISCORD_CREATE_CHANNEL]: 'action',
  [FlowNodeType.DISCORD_DELETE_CHANNEL]: 'action',
  [FlowNodeType.DISCORD_MOVE_MEMBER]: 'action',
  [FlowNodeType.DISCORD_CREATE_THREAD]: 'action',
  [FlowNodeType.DISCORD_SEND_THREAD_MESSAGE]: 'action',
  [FlowNodeType.DISCORD_CREATE_INVITE]: 'action',
  [FlowNodeType.DISCORD_CREATE_SCHEDULED_EVENT]: 'action',
};
