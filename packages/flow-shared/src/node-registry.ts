export interface NodeTypeDefinition {
  type: string
  label: string
  category: 'trigger' | 'condition' | 'action' | 'advanced' | 'annotation'
  platform: 'telegram' | 'discord' | 'general'
  color: string
  subcategory?: string              // 'user_account' for MTProto-only nodes
  requiresConnection?: boolean      // true if node needs a PlatformConnection
}

export const NODE_TYPES: NodeTypeDefinition[] = [
  // === TELEGRAM TRIGGERS ===
  { type: 'message_received', label: 'Message Received', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'user_joins', label: 'User Joins', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'user_leaves', label: 'User Leaves', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'callback_query', label: 'Button Click', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'command_received', label: 'Command', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'message_edited', label: 'Message Edited', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'chat_member_updated', label: 'Member Status', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'schedule', label: 'Schedule', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'webhook', label: 'Webhook', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'poll_answer', label: 'Poll Answer', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'inline_query', label: 'Inline Query', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'my_chat_member', label: 'Bot Status Change', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'new_chat_title', label: 'Chat Title Changed', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'new_chat_photo', label: 'Chat Photo Changed', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  // New Telegram triggers (SP2)
  { type: 'inline_result_chosen', label: 'Inline Result Chosen', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'pre_checkout_query', label: 'Pre-Checkout', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'successful_payment', label: 'Payment Success', category: 'trigger', platform: 'telegram', color: '#22c55e' },
  { type: 'web_app_data', label: 'Web App Data', category: 'trigger', platform: 'telegram', color: '#22c55e' },

  // === TELEGRAM CONDITIONS ===
  { type: 'keyword_match', label: 'Keyword Match', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'user_role', label: 'User Role', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'time_based', label: 'Time Based', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'message_type', label: 'Message Type', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'chat_type', label: 'Chat Type', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'regex_match', label: 'Regex Match', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'has_media', label: 'Has Media', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'user_is_admin', label: 'Is Admin', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'message_length', label: 'Message Length', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'callback_data_match', label: 'Callback Data', category: 'condition', platform: 'telegram', color: '#eab308' },
  { type: 'user_is_bot', label: 'Is Bot', category: 'condition', platform: 'telegram', color: '#eab308' },

  // === TELEGRAM ACTIONS — Messaging ===
  { type: 'send_message', label: 'Send Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_photo', label: 'Send Photo', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'forward_message', label: 'Forward Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'copy_message', label: 'Copy Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'edit_message', label: 'Edit Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'delete_message', label: 'Delete Message', category: 'action', platform: 'telegram', color: '#ef4444' },
  { type: 'pin_message', label: 'Pin Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'unpin_message', label: 'Unpin Message', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_video', label: 'Send Video', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_document', label: 'Send Document', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_sticker', label: 'Send Sticker', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_location', label: 'Send Location', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_voice', label: 'Send Voice', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_contact', label: 'Send Contact', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'set_chat_title', label: 'Set Chat Title', category: 'action', platform: 'telegram', color: '#6366f1' },
  { type: 'set_chat_description', label: 'Set Description', category: 'action', platform: 'telegram', color: '#6366f1' },
  { type: 'export_invite_link', label: 'Invite Link', category: 'action', platform: 'telegram', color: '#6366f1' },
  { type: 'get_chat_member', label: 'Get Member', category: 'action', platform: 'telegram', color: '#6366f1' },
  // User management
  { type: 'ban_user', label: 'Ban User', category: 'action', platform: 'telegram', color: '#ef4444' },
  { type: 'mute_user', label: 'Mute User', category: 'action', platform: 'telegram', color: '#ef4444' },
  { type: 'restrict_user', label: 'Restrict User', category: 'action', platform: 'telegram', color: '#ef4444' },
  { type: 'promote_user', label: 'Promote User', category: 'action', platform: 'telegram', color: '#10b981' },
  // Interactive
  { type: 'create_poll', label: 'Create Poll', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'answer_callback_query', label: 'Answer Button', category: 'action', platform: 'telegram', color: '#3b82f6' },
  // New Telegram actions (SP2)
  { type: 'answer_inline_query', label: 'Answer Inline', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'send_invoice', label: 'Send Invoice', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'answer_pre_checkout', label: 'Answer Pre-Checkout', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'set_chat_menu_button', label: 'Set Menu Button', category: 'action', platform: 'telegram', color: '#6366f1' },
  { type: 'send_media_group', label: 'Send Media Group', category: 'action', platform: 'telegram', color: '#3b82f6' },
  { type: 'create_forum_topic', label: 'Create Forum Topic', category: 'action', platform: 'telegram', color: '#6366f1' },
  { type: 'set_my_commands', label: 'Set Commands', category: 'action', platform: 'telegram', color: '#6366f1' },

  // === GENERAL — Utility ===
  { type: 'api_call', label: 'API Call', category: 'action', platform: 'general', color: '#3b82f6' },
  { type: 'delay', label: 'Delay', category: 'action', platform: 'general', color: '#8b5cf6' },
  { type: 'bot_action', label: 'Bot Action', category: 'action', platform: 'general', color: '#f97316' },

  // === GENERAL — Context ===
  { type: 'get_context', label: 'Get Context', category: 'action', platform: 'general', color: '#14b8a6' },
  { type: 'set_context', label: 'Set Context', category: 'action', platform: 'general', color: '#14b8a6' },
  { type: 'delete_context', label: 'Delete Context', category: 'action', platform: 'general', color: '#14b8a6' },
  { type: 'context_condition', label: 'Context Check', category: 'condition', platform: 'general', color: '#14b8a6' },

  // === GENERAL — Flow Chaining ===
  { type: 'run_flow', label: 'Run Flow', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'emit_event', label: 'Emit Event', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'custom_event', label: 'Custom Event', category: 'trigger', platform: 'general', color: '#a855f7' },

  // === GENERAL — Advanced ===
  { type: 'parallel_branch', label: 'Parallel Branch', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'db_query', label: 'Database Query', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'loop', label: 'Loop', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'switch', label: 'Switch/Router', category: 'advanced', platform: 'general', color: '#a855f7' },
  { type: 'transform', label: 'Transform', category: 'advanced', platform: 'general', color: '#a855f7' },

  // === UNIFIED CROSS-PLATFORM ===
  { type: 'unified_send_message', label: 'Send Message (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_send_media', label: 'Send Media (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_delete_message', label: 'Delete Message (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_ban_user', label: 'Ban User (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_kick_user', label: 'Kick User (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_pin_message', label: 'Pin Message (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_send_dm', label: 'Send DM (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },
  { type: 'unified_set_role', label: 'Set Role (Cross)', category: 'action', platform: 'general', color: '#06b6d4' },

  // === TELEGRAM USER ACCOUNT ACTIONS — Read ===
  { type: 'user_get_chat_history', label: 'Get Chat History', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_search_messages', label: 'Search Messages', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_all_members', label: 'Get All Members', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_chat_info', label: 'Get Chat Info', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_contacts', label: 'Get Contacts', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_dialogs', label: 'Get Dialogs', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },

  // === TELEGRAM USER ACCOUNT ACTIONS — Write ===
  { type: 'user_join_chat', label: 'Join Chat', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_leave_chat', label: 'Leave Chat', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_create_group', label: 'Create Group', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_create_channel', label: 'Create Channel', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_invite_users', label: 'Invite Users', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_send_message', label: 'Send as User', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_send_media', label: 'Send Media as User', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_forward_message', label: 'Forward Message', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_delete_messages', label: 'Delete Messages', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },

  // === TELEGRAM USER ACCOUNT ACTIONS — Account ===
  { type: 'user_update_profile', label: 'Update Profile', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_set_status', label: 'Set Status', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },
  { type: 'user_get_profile_photos', label: 'Get Profile Photos', category: 'action', platform: 'telegram', color: '#8B5CF6', subcategory: 'user_account', requiresConnection: true },

  // === DISCORD TRIGGERS ===
  { type: 'discord_message_received', label: 'Discord Message', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_member_join', label: 'Discord Member Join', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_member_leave', label: 'Discord Member Leave', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_reaction_add', label: 'Discord Reaction Add', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_reaction_remove', label: 'Discord Reaction Remove', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_voice_state_update', label: 'Discord Voice Update', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_interaction_create', label: 'Discord Interaction', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_channel_create', label: 'Discord Channel Create', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_channel_delete', label: 'Discord Channel Delete', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_role_update', label: 'Discord Role Update', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_scheduled_event', label: 'Discord Scheduled Event', category: 'trigger', platform: 'discord', color: '#5865F2' },
  // New Discord triggers (SP2)
  { type: 'discord_slash_command', label: 'Slash Command', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_modal_submit', label: 'Modal Submit', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_select_menu', label: 'Select Menu', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_button_click', label: 'Button Click', category: 'trigger', platform: 'discord', color: '#5865F2' },
  { type: 'discord_autocomplete', label: 'Autocomplete', category: 'trigger', platform: 'discord', color: '#5865F2' },

  // === DISCORD CONDITIONS ===
  { type: 'discord_has_role', label: 'Discord Has Role', category: 'condition', platform: 'discord', color: '#57F287' },
  { type: 'discord_channel_type', label: 'Discord Channel Type', category: 'condition', platform: 'discord', color: '#57F287' },
  { type: 'discord_is_bot', label: 'Discord Is Bot', category: 'condition', platform: 'discord', color: '#57F287' },
  { type: 'discord_message_has_embed', label: 'Discord Has Embed', category: 'condition', platform: 'discord', color: '#57F287' },
  { type: 'discord_member_permissions', label: 'Discord Permissions', category: 'condition', platform: 'discord', color: '#57F287' },

  // === DISCORD ACTIONS ===
  { type: 'discord_send_message', label: 'Discord Send Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_send_embed', label: 'Discord Send Embed', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_send_dm', label: 'Discord Send DM', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_edit_message', label: 'Discord Edit Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_delete_message', label: 'Discord Delete Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_add_reaction', label: 'Discord Add Reaction', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_remove_reaction', label: 'Discord Remove Reaction', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_pin_message', label: 'Discord Pin Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_unpin_message', label: 'Discord Unpin Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_ban_member', label: 'Discord Ban Member', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_kick_member', label: 'Discord Kick Member', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_timeout_member', label: 'Discord Timeout Member', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_add_role', label: 'Discord Add Role', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_remove_role', label: 'Discord Remove Role', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_role', label: 'Discord Create Role', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_set_nickname', label: 'Discord Set Nickname', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_channel', label: 'Discord Create Channel', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_delete_channel', label: 'Discord Delete Channel', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_move_member', label: 'Discord Move to Voice', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_thread', label: 'Discord Create Thread', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_send_thread_message', label: 'Discord Thread Message', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_invite', label: 'Discord Create Invite', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_scheduled_event', label: 'Discord Schedule Event', category: 'action', platform: 'discord', color: '#5865F2' },
  // New Discord actions (SP2)
  { type: 'discord_reply_interaction', label: 'Reply Interaction', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_show_modal', label: 'Show Modal', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_send_components', label: 'Send Components', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_edit_interaction', label: 'Edit Interaction', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_defer_reply', label: 'Defer Reply', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_set_channel_permissions', label: 'Set Permissions', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_create_forum_post', label: 'Create Forum Post', category: 'action', platform: 'discord', color: '#5865F2' },
  { type: 'discord_register_commands', label: 'Register Commands', category: 'action', platform: 'discord', color: '#5865F2' },
]

export function getNodesByPlatform(platform: 'telegram' | 'discord' | 'general' | 'all'): NodeTypeDefinition[] {
  if (platform === 'all') return NODE_TYPES
  return NODE_TYPES.filter(n => n.platform === platform || n.platform === 'general')
}

export function getNodesByCategory(category: string): NodeTypeDefinition[] {
  return NODE_TYPES.filter(n => n.category === category)
}
