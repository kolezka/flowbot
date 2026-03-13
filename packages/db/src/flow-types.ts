export enum FlowNodeType {
  // Triggers
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

  // Conditions
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

  // Actions
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
}

export type FlowNodeCategory = 'trigger' | 'condition' | 'action' | 'advanced';

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

export interface FlowDefinitionData {
  nodes: FlowNode[];
  edges: FlowEdge[];
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
};
