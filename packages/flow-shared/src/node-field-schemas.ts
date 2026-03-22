// ---------------------------------------------------------------------------
// Node Field Schema System — Flow Builder 2.0
//
// Each NodeTypeSchema declares the configurable fields for a node type and the
// output variables that node produces for downstream variable interpolation.
//
// Field types map to the existing property-panel input components:
//   TextInput      → "text"
//   TextareaInput  → "textarea"
//   SelectInput    → "select"
//   CheckboxInput  → "checkbox"
//   NumberInput    → "number"
//   permissions group → "permissions"
// ---------------------------------------------------------------------------

export interface NodeFieldSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number" | "permissions";
  placeholder?: string;
  required?: boolean;
  supportsVariables?: boolean;
  options?: ReadonlyArray<{ label: string; value: string }>;
  validation?: { pattern?: string; min?: number; max?: number };
  defaultValue?: string | number | boolean;
}

export interface NodeOutputSchema {
  key: string;
  type: "string" | "number" | "boolean" | "object";
}

export interface NodeTypeSchema {
  type: string;
  fields: ReadonlyArray<NodeFieldSchema>;
  outputs: ReadonlyArray<NodeOutputSchema>;
}

// ---------------------------------------------------------------------------
// Shared option sets
// ---------------------------------------------------------------------------

const PARSE_MODE_OPTIONS = [
  { value: "HTML", label: "HTML" },
  { value: "MarkdownV2", label: "Markdown V2" },
  { value: "", label: "None" },
] as const;

const DISCORD_CHANNEL_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "voice", label: "Voice" },
  { value: "category", label: "Category" },
  { value: "forum", label: "Forum" },
  { value: "stage", label: "Stage" },
] as const;

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

export const NODE_FIELD_SCHEMAS: ReadonlyArray<NodeTypeSchema> = [
  // =========================================================================
  // TELEGRAM TRIGGERS
  // =========================================================================

  {
    type: "message_received",
    fields: [],
    outputs: [
      { key: "chatId", type: "string" },
      { key: "userId", type: "string" },
      { key: "messageId", type: "string" },
      { key: "messageText", type: "string" },
      { key: "senderName", type: "string" },
      { key: "isAdmin", type: "boolean" },
      { key: "chatType", type: "string" },
    ],
  },

  {
    type: "user_joins",
    fields: [],
    outputs: [
      { key: "chatId", type: "string" },
      { key: "userId", type: "string" },
      { key: "userName", type: "string" },
    ],
  },

  {
    type: "user_leaves",
    fields: [
      {
        key: "includeKicked",
        label: "Include kicked users",
        type: "checkbox",
        defaultValue: true,
      },
    ],
    outputs: [
      { key: "chatId", type: "string" },
      { key: "userId", type: "string" },
      { key: "userName", type: "string" },
      { key: "wasKicked", type: "boolean" },
    ],
  },

  {
    type: "callback_query",
    fields: [
      {
        key: "dataPattern",
        label: "Callback Data Pattern",
        type: "text",
        placeholder: "action:confirm",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "callbackData", type: "string" },
      { key: "callbackQueryId", type: "string" },
      { key: "userId", type: "string" },
      { key: "chatId", type: "string" },
      { key: "messageId", type: "string" },
    ],
  },

  {
    type: "command_received",
    fields: [
      {
        key: "command",
        label: "Command (e.g. /start)",
        type: "text",
        placeholder: "/start",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "command", type: "string" },
      { key: "args", type: "string" },
      { key: "chatId", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "message_edited",
    fields: [],
    outputs: [
      { key: "text", type: "string" },
      { key: "messageId", type: "string" },
      { key: "chatId", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "chat_member_updated",
    fields: [
      {
        key: "oldStatus",
        label: "Old Status Filter",
        type: "text",
        placeholder: "Any (leave empty)",
        supportsVariables: false,
      },
      {
        key: "newStatus",
        label: "New Status Filter",
        type: "text",
        placeholder: "Any (leave empty)",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "oldStatus", type: "string" },
      { key: "newStatus", type: "string" },
      { key: "userId", type: "string" },
      { key: "chatId", type: "string" },
    ],
  },

  {
    type: "schedule",
    fields: [
      {
        key: "cron",
        label: "Cron Expression",
        type: "text",
        placeholder: "0 9 * * 1",
        supportsVariables: false,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "webhook",
    fields: [],
    outputs: [{ key: "payload", type: "object" }],
  },

  {
    type: "poll_answer",
    fields: [
      {
        key: "pollId",
        label: "Poll ID Filter",
        type: "text",
        placeholder: "Optional: filter by poll ID",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "pollId", type: "string" },
      { key: "optionIds", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "inline_query",
    fields: [
      {
        key: "queryPattern",
        label: "Query Pattern",
        type: "text",
        placeholder: "Optional regex filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "query", type: "string" },
      { key: "queryId", type: "string" },
      { key: "offset", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "my_chat_member",
    fields: [
      {
        key: "oldStatus",
        label: "Old Status Filter",
        type: "text",
        placeholder: "Any (leave empty)",
        supportsVariables: false,
      },
      {
        key: "newStatus",
        label: "New Status Filter",
        type: "text",
        placeholder: "Any (leave empty)",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "oldStatus", type: "string" },
      { key: "newStatus", type: "string" },
      { key: "chatId", type: "string" },
    ],
  },

  {
    type: "new_chat_title",
    fields: [],
    outputs: [
      { key: "title", type: "string" },
      { key: "userId", type: "string" },
      { key: "chatId", type: "string" },
    ],
  },

  {
    type: "new_chat_photo",
    fields: [],
    outputs: [
      { key: "userId", type: "string" },
      { key: "chatId", type: "string" },
    ],
  },

  // SP2 Telegram triggers (no config panels, metadata-only)
  {
    type: "inline_result_chosen",
    fields: [],
    outputs: [
      { key: "resultId", type: "string" },
      { key: "query", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "pre_checkout_query",
    fields: [],
    outputs: [
      { key: "queryId", type: "string" },
      { key: "userId", type: "string" },
      { key: "currency", type: "string" },
      { key: "totalAmount", type: "number" },
    ],
  },

  {
    type: "successful_payment",
    fields: [],
    outputs: [
      { key: "currency", type: "string" },
      { key: "totalAmount", type: "number" },
      { key: "invoicePayload", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "web_app_data",
    fields: [],
    outputs: [
      { key: "data", type: "string" },
      { key: "buttonText", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  // =========================================================================
  // TELEGRAM CONDITIONS
  // =========================================================================

  {
    type: "keyword_match",
    fields: [
      {
        key: "keywords",
        label: "Keywords (comma-separated)",
        type: "text",
        placeholder: "hello, hi, hey",
        supportsVariables: false,
      },
      {
        key: "caseSensitive",
        label: "Case sensitive",
        type: "checkbox",
        defaultValue: false,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "user_role",
    fields: [
      {
        key: "roles",
        label: "Required roles (comma-separated)",
        type: "text",
        placeholder: "admin, creator",
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "time_based",
    fields: [
      {
        key: "startTime",
        label: "Start Time (HH:MM)",
        type: "text",
        placeholder: "09:00",
        supportsVariables: false,
      },
      {
        key: "endTime",
        label: "End Time (HH:MM)",
        type: "text",
        placeholder: "17:00",
        supportsVariables: false,
      },
      {
        key: "timezone",
        label: "Timezone",
        type: "text",
        placeholder: "UTC",
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "message_type",
    fields: [
      // Rendered as a checkbox group — each message type is an individual checkbox.
      // Key is "types" (array). Modelled as a single "permissions"-style field.
      {
        key: "types",
        label: "Match Message Types",
        type: "permissions",
        options: [
          { value: "text", label: "text" },
          { value: "photo", label: "photo" },
          { value: "video", label: "video" },
          { value: "document", label: "document" },
          { value: "sticker", label: "sticker" },
          { value: "voice", label: "voice" },
          { value: "audio", label: "audio" },
          { value: "animation", label: "animation" },
          { value: "location", label: "location" },
          { value: "contact", label: "contact" },
          { value: "poll", label: "poll" },
        ],
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "chat_type",
    fields: [
      {
        key: "types",
        label: "Match Chat Types",
        type: "permissions",
        options: [
          { value: "private", label: "private" },
          { value: "group", label: "group" },
          { value: "supergroup", label: "supergroup" },
          { value: "channel", label: "channel" },
        ],
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "regex_match",
    fields: [
      {
        key: "pattern",
        label: "Regex Pattern",
        type: "text",
        placeholder: "\\d{4,}",
        required: true,
        supportsVariables: false,
      },
      {
        key: "flags",
        label: "Flags",
        type: "text",
        placeholder: "i",
        defaultValue: "i",
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "has_media",
    fields: [
      {
        key: "mediaTypes",
        label: "Filter by media type (optional)",
        type: "permissions",
        options: [
          { value: "photo", label: "photo" },
          { value: "video", label: "video" },
          { value: "document", label: "document" },
          { value: "sticker", label: "sticker" },
          { value: "voice", label: "voice" },
          { value: "audio", label: "audio" },
          { value: "animation", label: "animation" },
        ],
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "user_is_admin",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "message_length",
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        defaultValue: "less_than",
        options: [
          { value: "less_than", label: "Less than" },
          { value: "greater_than", label: "Greater than" },
          { value: "equals", label: "Equals" },
          { value: "between", label: "Between" },
        ],
      },
      {
        key: "threshold",
        label: "Threshold",
        type: "number",
        defaultValue: 100,
        validation: { min: 0 },
      },
      {
        key: "maxThreshold",
        label: "Max Threshold",
        type: "number",
        defaultValue: 500,
        validation: { min: 0 },
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "callback_data_match",
    fields: [
      {
        key: "pattern",
        label: "Pattern",
        type: "text",
        placeholder: "action:*",
        required: true,
        supportsVariables: false,
      },
      {
        key: "matchMode",
        label: "Match Mode",
        type: "select",
        defaultValue: "exact",
        options: [
          { value: "exact", label: "Exact match" },
          { value: "starts_with", label: "Starts with" },
          { value: "contains", label: "Contains" },
          { value: "regex", label: "Regex" },
        ],
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "user_is_bot",
    fields: [
      {
        key: "matchBots",
        label: "Match bots (uncheck to match non-bots)",
        type: "checkbox",
        defaultValue: true,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  // =========================================================================
  // TELEGRAM ACTIONS — Messaging
  // =========================================================================

  {
    type: "send_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "text",
        label: "Text",
        type: "textarea",
        placeholder: "Hello {{trigger.userName}}!",
        supportsVariables: true,
        required: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
      {
        key: "disableNotification",
        label: "Disable notification",
        type: "checkbox",
        defaultValue: false,
      },
      {
        key: "replyToMessageId",
        label: "Reply to Message ID",
        type: "text",
        placeholder: "Optional",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_photo",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "photoUrl",
        label: "Photo URL",
        type: "text",
        placeholder: "https://example.com/photo.jpg",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_video",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "videoUrl",
        label: "Video URL",
        type: "text",
        placeholder: "https://example.com/video.mp4",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
      {
        key: "duration",
        label: "Duration (seconds)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
      {
        key: "supportsStreaming",
        label: "Supports streaming",
        type: "checkbox",
        defaultValue: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_document",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "documentUrl",
        label: "Document URL",
        type: "text",
        placeholder: "https://example.com/file.pdf",
        supportsVariables: true,
        required: true,
      },
      {
        key: "fileName",
        label: "File Name",
        type: "text",
        placeholder: "Optional display name",
        supportsVariables: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_sticker",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "sticker",
        label: "Sticker (file_id or URL)",
        type: "text",
        placeholder: "CAACAgIAAxkBAAI...",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_voice",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "voiceUrl",
        label: "Voice URL",
        type: "text",
        placeholder: "https://example.com/voice.ogg",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
      {
        key: "duration",
        label: "Duration (seconds)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_location",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "latitude",
        label: "Latitude",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      {
        key: "longitude",
        label: "Longitude",
        type: "number",
        defaultValue: 0,
        required: true,
      },
      {
        key: "livePeriod",
        label: "Live Period (seconds, 0 = static)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0, max: 86400 },
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "send_contact",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "phoneNumber",
        label: "Phone Number",
        type: "text",
        placeholder: "+1234567890",
        supportsVariables: true,
        required: true,
      },
      {
        key: "firstName",
        label: "First Name",
        type: "text",
        placeholder: "John",
        supportsVariables: true,
        required: true,
      },
      {
        key: "lastName",
        label: "Last Name",
        type: "text",
        placeholder: "Optional",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "forward_message",
    fields: [
      {
        key: "fromChatId",
        label: "From Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "toChatId",
        label: "To Chat ID",
        type: "text",
        placeholder: "Target chat ID",
        supportsVariables: true,
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "copy_message",
    fields: [
      {
        key: "fromChatId",
        label: "From Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "toChatId",
        label: "To Chat ID",
        type: "text",
        placeholder: "Target chat ID",
        supportsVariables: true,
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "edit_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "text",
        label: "New Text",
        type: "textarea",
        placeholder: "Updated message text",
        supportsVariables: true,
        required: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [],
  },

  {
    type: "delete_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "pin_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "disableNotification",
        label: "Disable notification",
        type: "checkbox",
        defaultValue: false,
      },
    ],
    outputs: [],
  },

  {
    type: "unpin_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID (leave empty to unpin all)",
        type: "text",
        placeholder: "Optional",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // TELEGRAM ACTIONS — User Management
  // =========================================================================

  {
    type: "ban_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional ban reason",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    // No panel in the editor — falls through to default null.
    // Providing basic fields inferred from the Telegram Bot API.
    type: "unban_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "onlyIfBanned",
        label: "Only if currently banned",
        type: "checkbox",
        defaultValue: true,
      },
    ],
    outputs: [],
  },

  {
    type: "mute_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "durationSeconds",
        label: "Duration (seconds)",
        type: "number",
        defaultValue: 3600,
        validation: { min: 0 },
      },
    ],
    outputs: [],
  },

  {
    // No panel in the editor — inferred from Telegram Bot API.
    type: "unmute_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "restrict_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "untilDate",
        label: "Duration (seconds, 0 = forever)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
      {
        key: "permissions",
        label: "Permissions",
        type: "permissions",
        options: [
          { value: "canSendMessages", label: "Can Send Messages" },
          { value: "canSendMedia", label: "Can Send Media" },
          { value: "canSendPolls", label: "Can Send Polls" },
          { value: "canSendOther", label: "Can Send Other" },
          { value: "canAddWebPagePreviews", label: "Can Add Web Page Previews" },
          { value: "canChangeInfo", label: "Can Change Info" },
          { value: "canInviteUsers", label: "Can Invite Users" },
          { value: "canPinMessages", label: "Can Pin Messages" },
        ],
      },
    ],
    outputs: [],
  },

  {
    type: "promote_user",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "privileges",
        label: "Admin Privileges",
        type: "permissions",
        options: [
          { value: "canManageChat", label: "Can Manage Chat" },
          { value: "canDeleteMessages", label: "Can Delete Messages" },
          { value: "canManageVideoChats", label: "Can Manage Video Chats" },
          { value: "canRestrictMembers", label: "Can Restrict Members" },
          { value: "canPromoteMembers", label: "Can Promote Members" },
          { value: "canChangeInfo", label: "Can Change Info" },
          { value: "canInviteUsers", label: "Can Invite Users" },
          { value: "canPinMessages", label: "Can Pin Messages" },
        ],
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // TELEGRAM ACTIONS — Interactive
  // =========================================================================

  {
    type: "create_poll",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "question",
        label: "Question",
        type: "text",
        placeholder: "What do you think?",
        supportsVariables: true,
        required: true,
      },
      {
        key: "options",
        label: "Options (one per line)",
        type: "textarea",
        placeholder: "Option 1\nOption 2\nOption 3",
        supportsVariables: true,
        required: true,
      },
      {
        key: "pollType",
        label: "Poll Type",
        type: "select",
        defaultValue: "regular",
        options: [
          { value: "regular", label: "Regular" },
          { value: "quiz", label: "Quiz" },
        ],
      },
      {
        key: "isAnonymous",
        label: "Anonymous",
        type: "checkbox",
        defaultValue: true,
      },
      {
        key: "allowsMultipleAnswers",
        label: "Multiple answers",
        type: "checkbox",
        defaultValue: false,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "answer_callback_query",
    fields: [
      {
        key: "callbackQueryId",
        label: "Callback Query ID",
        type: "text",
        placeholder: "{{trigger.callbackQueryId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.callbackQueryId}}",
        required: true,
      },
      {
        key: "text",
        label: "Response Text",
        type: "text",
        placeholder: "Optional toast message",
        supportsVariables: true,
      },
      {
        key: "showAlert",
        label: "Show alert popup",
        type: "checkbox",
        defaultValue: false,
      },
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "Optional redirect URL",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // TELEGRAM ACTIONS — Chat Management
  // =========================================================================

  {
    type: "set_chat_title",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "title",
        label: "New Title",
        type: "text",
        placeholder: "New chat title (max 128 chars)",
        supportsVariables: true,
        required: true,
        validation: { max: 128 },
      },
    ],
    outputs: [],
  },

  {
    type: "set_chat_description",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        placeholder: "New chat description (max 255 chars)",
        supportsVariables: true,
        required: true,
        validation: { max: 255 },
      },
    ],
    outputs: [],
  },

  {
    // The editor uses "export_invite_link" as the case key.
    // Node registry lists both "export_invite_link" and "create_invite_link".
    // This schema covers the primary export_invite_link type.
    type: "export_invite_link",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "name",
        label: "Link Name",
        type: "text",
        placeholder: "Optional link name",
        supportsVariables: true,
      },
      {
        key: "memberLimit",
        label: "Member Limit (0 = unlimited)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0, max: 99999 },
      },
      {
        key: "expireDate",
        label: "Expire (seconds from now, 0 = never)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
    ],
    outputs: [{ key: "inviteLink", type: "string" }],
  },

  {
    // Alias for export_invite_link (same fields, different node type name in task description)
    type: "create_invite_link",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "name",
        label: "Link Name",
        type: "text",
        placeholder: "Optional link name",
        supportsVariables: true,
      },
      {
        key: "memberLimit",
        label: "Member Limit (0 = unlimited)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0, max: 99999 },
      },
      {
        key: "expireDate",
        label: "Expire (seconds from now, 0 = never)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
    ],
    outputs: [{ key: "inviteLink", type: "string" }],
  },

  {
    // Alias: "export_chat_invite_link" is a simpler variant (no options)
    type: "export_chat_invite_link",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
    ],
    outputs: [{ key: "inviteLink", type: "string" }],
  },

  {
    type: "get_chat_member",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
    ],
    outputs: [
      { key: "status", type: "string" },
      { key: "isAdmin", type: "boolean" },
      { key: "permissions", type: "object" },
    ],
  },

  {
    // No dedicated panel in the editor; inferred from Telegram Bot API
    type: "set_chat_photo",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "photoUrl",
        label: "Photo URL",
        type: "text",
        placeholder: "https://example.com/photo.jpg",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    // No dedicated panel in the editor; inferred from Telegram Bot API
    type: "delete_chat_photo",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // TELEGRAM ACTIONS — SP2 (New)
  // =========================================================================

  {
    type: "send_media_group",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "media",
        label: "Media Items (JSON array)",
        type: "textarea",
        placeholder: '[{"type":"photo","media":"https://...","caption":"Caption"}]',
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageIds", type: "object" }],
  },

  {
    type: "answer_inline_query",
    fields: [
      {
        key: "inlineQueryId",
        label: "Inline Query ID",
        type: "text",
        placeholder: "{{trigger.queryId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "results",
        label: "Results (JSON array)",
        type: "textarea",
        placeholder: '[{"type":"article","id":"1","title":"Result","input_message_content":{...}}]',
        supportsVariables: false,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "send_invoice",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "title",
        label: "Title",
        type: "text",
        placeholder: "Product Name",
        supportsVariables: true,
        required: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Product description",
        supportsVariables: true,
        required: true,
      },
      {
        key: "payload",
        label: "Payload",
        type: "text",
        placeholder: "invoice_payload",
        supportsVariables: true,
        required: true,
      },
      {
        key: "currency",
        label: "Currency",
        type: "text",
        placeholder: "USD",
        required: true,
      },
      {
        key: "prices",
        label: "Prices (JSON array)",
        type: "textarea",
        placeholder: '[{"label":"Item","amount":1000}]',
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "answer_pre_checkout",
    fields: [
      {
        key: "preCheckoutQueryId",
        label: "Pre-Checkout Query ID",
        type: "text",
        placeholder: "{{trigger.queryId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "ok",
        label: "Approve checkout",
        type: "checkbox",
        defaultValue: true,
      },
      {
        key: "errorMessage",
        label: "Error Message (if not approved)",
        type: "text",
        placeholder: "Payment declined",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "set_chat_menu_button",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
      },
      {
        key: "menuButton",
        label: "Menu Button (JSON)",
        type: "textarea",
        placeholder: '{"type":"web_app","text":"Open App","web_app":{"url":"https://..."}}',
        supportsVariables: false,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "create_forum_topic",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "name",
        label: "Topic Name",
        type: "text",
        placeholder: "New topic",
        supportsVariables: true,
        required: true,
      },
      {
        key: "iconColor",
        label: "Icon Color (int)",
        type: "number",
        defaultValue: 0,
      },
    ],
    outputs: [{ key: "messageThreadId", type: "string" }],
  },

  {
    type: "set_my_commands",
    fields: [
      {
        key: "commands",
        label: "Commands (JSON array)",
        type: "textarea",
        placeholder: '[{"command":"start","description":"Start the bot"}]',
        required: true,
      },
      {
        key: "scope",
        label: "Scope (JSON)",
        type: "text",
        placeholder: '{"type":"default"}',
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // TELEGRAM USER ACCOUNT ACTIONS
  // =========================================================================

  {
    type: "user_send_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "text",
        label: "Text",
        type: "textarea",
        placeholder: "Message text",
        supportsVariables: true,
        required: true,
      },
      {
        key: "parseMode",
        label: "Parse Mode",
        type: "select",
        defaultValue: "HTML",
        options: PARSE_MODE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_photo",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "photoUrl",
        label: "Photo URL or file_id",
        type: "text",
        placeholder: "https://example.com/photo.jpg",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_video",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "videoUrl",
        label: "Video URL or file_id",
        type: "text",
        placeholder: "https://example.com/video.mp4",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_document",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "documentUrl",
        label: "Document URL or file_id",
        type: "text",
        placeholder: "https://example.com/file.pdf",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_voice",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "voiceUrl",
        label: "Voice URL or file_id",
        type: "text",
        placeholder: "https://example.com/voice.ogg",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_sticker",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "sticker",
        label: "Sticker (file_id or URL)",
        type: "text",
        placeholder: "CAACAgIAAxkBAAI...",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_send_animation",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "animationUrl",
        label: "Animation URL or file_id",
        type: "text",
        placeholder: "https://example.com/animation.gif",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_forward_message",
    fields: [
      {
        key: "fromChatId",
        label: "From Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "toChatId",
        label: "To Chat ID",
        type: "text",
        placeholder: "Target chat ID",
        supportsVariables: true,
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "user_join_group",
    fields: [
      {
        key: "chatId",
        label: "Chat ID or invite link",
        type: "text",
        placeholder: "https://t.me/joinchat/...",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_leave_group",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_get_participants",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "limit",
        label: "Limit",
        type: "number",
        defaultValue: 100,
        validation: { min: 1, max: 10000 },
      },
    ],
    outputs: [{ key: "participants", type: "object" }],
  },

  {
    type: "user_get_chat_info",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
    ],
    outputs: [
      { key: "title", type: "string" },
      { key: "memberCount", type: "number" },
      { key: "description", type: "string" },
    ],
  },

  {
    type: "user_search_messages",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "query",
        label: "Search Query",
        type: "text",
        placeholder: "Search term",
        supportsVariables: true,
        required: true,
      },
      {
        key: "limit",
        label: "Limit",
        type: "number",
        defaultValue: 20,
        validation: { min: 1, max: 100 },
      },
    ],
    outputs: [{ key: "messages", type: "object" }],
  },

  {
    type: "user_pin_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_unpin_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_edit_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "text",
        label: "New Text",
        type: "textarea",
        placeholder: "Updated message text",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_delete_message",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "user_get_dialogs",
    fields: [
      {
        key: "limit",
        label: "Limit",
        type: "number",
        defaultValue: 20,
        validation: { min: 1, max: 100 },
      },
    ],
    outputs: [{ key: "dialogs", type: "object" }],
  },

  {
    type: "user_read_history",
    fields: [
      {
        key: "chatId",
        label: "Chat ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "maxId",
        label: "Max Message ID (0 = all)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // DISCORD TRIGGERS
  // =========================================================================

  {
    type: "discord_message_received",
    fields: [
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "channelId", type: "string" },
      { key: "guildId", type: "string" },
      { key: "userId", type: "string" },
      { key: "messageContent", type: "string" },
      { key: "messageId", type: "string" },
      { key: "authorTag", type: "string" },
    ],
  },

  {
    type: "discord_member_join",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "userId", type: "string" },
      { key: "userTag", type: "string" },
    ],
  },

  {
    type: "discord_member_leave",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "userId", type: "string" },
      { key: "userTag", type: "string" },
    ],
  },

  {
    type: "discord_reaction_add",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "emoji", type: "string" },
      { key: "userId", type: "string" },
      { key: "messageId", type: "string" },
      { key: "channelId", type: "string" },
      { key: "guildId", type: "string" },
    ],
  },

  {
    type: "discord_reaction_remove",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "emoji", type: "string" },
      { key: "userId", type: "string" },
      { key: "messageId", type: "string" },
      { key: "channelId", type: "string" },
      { key: "guildId", type: "string" },
    ],
  },

  {
    type: "discord_voice_state_update",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "userId", type: "string" },
      { key: "channelId", type: "string" },
    ],
  },

  {
    type: "discord_interaction_create",
    fields: [
      {
        key: "commandName",
        label: "Command Name",
        type: "text",
        placeholder: "/mycommand",
        supportsVariables: false,
      },
      {
        key: "commandDescription",
        label: "Command Description",
        type: "text",
        placeholder: "What the command does",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "userId", type: "string" },
      { key: "guildId", type: "string" },
      { key: "channelId", type: "string" },
      { key: "commandName", type: "string" },
    ],
  },

  {
    type: "discord_channel_create",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "channelId", type: "string" },
      { key: "channelName", type: "string" },
    ],
  },

  {
    type: "discord_channel_delete",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "channelId", type: "string" },
      { key: "channelName", type: "string" },
    ],
  },

  {
    type: "discord_role_update",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "roleId", type: "string" },
      { key: "roleName", type: "string" },
    ],
  },

  {
    type: "discord_scheduled_event",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "guildId", type: "string" },
      { key: "eventId", type: "string" },
      { key: "eventName", type: "string" },
    ],
  },

  // SP2 Discord triggers
  {
    type: "discord_slash_command",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "commandName", type: "string" },
      { key: "userId", type: "string" },
      { key: "guildId", type: "string" },
      { key: "channelId", type: "string" },
    ],
  },

  {
    type: "discord_modal_submit",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "customId", type: "string" },
      { key: "userId", type: "string" },
      { key: "fields", type: "object" },
    ],
  },

  {
    type: "discord_select_menu",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "customId", type: "string" },
      { key: "values", type: "object" },
      { key: "userId", type: "string" },
    ],
  },

  {
    type: "discord_button_click",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "customId", type: "string" },
      { key: "userId", type: "string" },
      { key: "messageId", type: "string" },
    ],
  },

  {
    type: "discord_autocomplete",
    fields: [
      {
        key: "guildFilter",
        label: "Guild Filter",
        type: "text",
        placeholder: "Optional guild ID filter",
        supportsVariables: false,
      },
      {
        key: "channelFilter",
        label: "Channel Filter",
        type: "text",
        placeholder: "Optional channel ID filter",
        supportsVariables: false,
      },
    ],
    outputs: [
      { key: "interactionId", type: "string" },
      { key: "commandName", type: "string" },
      { key: "focusedOption", type: "string" },
      { key: "userId", type: "string" },
    ],
  },

  // =========================================================================
  // DISCORD CONDITIONS
  // =========================================================================

  {
    type: "discord_has_role",
    fields: [
      {
        key: "roleId",
        label: "Role ID",
        type: "text",
        placeholder: "Role ID to check",
        required: true,
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "discord_channel_type",
    fields: [
      {
        key: "channelType",
        label: "Channel Type",
        type: "select",
        defaultValue: "text",
        options: DISCORD_CHANNEL_TYPE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "discord_is_bot",
    fields: [],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "discord_message_has_embed",
    fields: [],
    outputs: [{ key: "result", type: "boolean" }],
  },

  {
    type: "discord_member_permissions",
    fields: [
      {
        key: "requiredPermissions",
        label: "Required Permissions",
        type: "text",
        placeholder: "MANAGE_MESSAGES, KICK_MEMBERS",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  // =========================================================================
  // DISCORD ACTIONS
  // =========================================================================

  {
    type: "discord_send_message",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Hello from the bot!",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "discord_send_embed",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "title",
        label: "Title",
        type: "text",
        placeholder: "Embed title",
        supportsVariables: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Embed description",
        supportsVariables: true,
      },
      {
        key: "color",
        label: "Color (hex)",
        type: "text",
        placeholder: "#5865F2",
        defaultValue: "#5865F2",
      },
      {
        key: "fields",
        label: "Fields (JSON)",
        type: "textarea",
        placeholder: '[{"name":"Field","value":"Value","inline":true}]',
        supportsVariables: false,
      },
      {
        key: "footer",
        label: "Footer",
        type: "text",
        placeholder: "Optional footer",
        supportsVariables: true,
      },
      {
        key: "imageUrl",
        label: "Image URL",
        type: "text",
        placeholder: "https://example.com/image.png",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "discord_send_dm",
    fields: [
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Direct message content",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "discord_edit_message",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Updated message",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_delete_message",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_add_reaction",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "emoji",
        label: "Emoji",
        type: "text",
        placeholder: "👍 or custom emoji ID",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_remove_reaction",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "emoji",
        label: "Emoji",
        type: "text",
        placeholder: "👍 or custom emoji ID",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_pin_message",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_unpin_message",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_ban_member",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional ban reason",
        supportsVariables: true,
      },
      {
        key: "deleteMessageDays",
        label: "Delete Message Days",
        type: "number",
        defaultValue: 0,
        validation: { min: 0, max: 7 },
      },
    ],
    outputs: [],
  },

  {
    type: "discord_kick_member",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional kick reason",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_timeout_member",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "durationMs",
        label: "Duration (ms)",
        type: "number",
        defaultValue: 60000,
        validation: { min: 0 },
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional reason",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_add_role",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "roleId",
        label: "Role ID",
        type: "text",
        placeholder: "Role ID",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_remove_role",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "roleId",
        label: "Role ID",
        type: "text",
        placeholder: "Role ID",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_create_role",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "name",
        label: "Name",
        type: "text",
        placeholder: "Role name",
        supportsVariables: true,
        required: true,
      },
      {
        key: "color",
        label: "Color (hex)",
        type: "text",
        placeholder: "#FF0000",
        supportsVariables: false,
      },
      {
        key: "permissions",
        label: "Permissions",
        type: "text",
        placeholder: "Permission bitfield",
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "roleId", type: "string" }],
  },

  {
    // In node registry as "discord_delete_role"; no panel in editor — inferred
    type: "discord_delete_role",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "roleId",
        label: "Role ID",
        type: "text",
        placeholder: "Role ID to delete",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_set_nickname",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "nickname",
        label: "Nickname",
        type: "text",
        placeholder: "New nickname",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_create_channel",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "name",
        label: "Name",
        type: "text",
        placeholder: "channel-name",
        supportsVariables: true,
        required: true,
      },
      {
        key: "type",
        label: "Type",
        type: "select",
        defaultValue: "text",
        options: DISCORD_CHANNEL_TYPE_OPTIONS as unknown as Array<{ label: string; value: string }>,
      },
    ],
    outputs: [{ key: "channelId", type: "string" }],
  },

  {
    type: "discord_delete_channel",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "Channel ID to delete",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_move_member",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "channelId",
        label: "Voice Channel ID",
        type: "text",
        placeholder: "Target voice channel",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_create_thread",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "name",
        label: "Thread Name",
        type: "text",
        placeholder: "Thread name",
        supportsVariables: true,
        required: true,
      },
      {
        key: "autoArchiveDuration",
        label: "Auto Archive Duration (min)",
        type: "number",
        defaultValue: 1440,
        validation: { min: 60 },
      },
    ],
    outputs: [{ key: "threadId", type: "string" }],
  },

  {
    type: "discord_send_thread_message",
    fields: [
      {
        key: "threadId",
        label: "Thread ID",
        type: "text",
        placeholder: "Thread ID",
        supportsVariables: true,
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Thread message",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "discord_create_invite",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "maxAge",
        label: "Max Age (seconds, 0 = never)",
        type: "number",
        defaultValue: 86400,
        validation: { min: 0 },
      },
      {
        key: "maxUses",
        label: "Max Uses (0 = unlimited)",
        type: "number",
        defaultValue: 0,
        validation: { min: 0 },
      },
    ],
    outputs: [{ key: "inviteCode", type: "string" }],
  },

  {
    type: "discord_create_scheduled_event",
    fields: [
      {
        key: "guildId",
        label: "Guild ID",
        type: "text",
        placeholder: "{{trigger.guildId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.guildId}}",
        required: true,
      },
      {
        key: "name",
        label: "Name",
        type: "text",
        placeholder: "Event name",
        supportsVariables: true,
        required: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        placeholder: "Event description",
        supportsVariables: true,
      },
      {
        key: "scheduledStartTime",
        label: "Scheduled Start Time",
        type: "text",
        placeholder: "ISO 8601 datetime",
        required: true,
        supportsVariables: true,
      },
      {
        key: "scheduledEndTime",
        label: "Scheduled End Time",
        type: "text",
        placeholder: "ISO 8601 datetime (optional)",
        supportsVariables: true,
      },
      {
        key: "entityType",
        label: "Entity Type",
        type: "select",
        defaultValue: "VOICE",
        options: [
          { value: "STAGE_INSTANCE", label: "Stage Instance" },
          { value: "VOICE", label: "Voice" },
          { value: "EXTERNAL", label: "External" },
        ],
      },
    ],
    outputs: [{ key: "eventId", type: "string" }],
  },

  // SP2 Discord actions
  {
    type: "discord_reply_interaction",
    fields: [
      {
        key: "interactionId",
        label: "Interaction ID",
        type: "text",
        placeholder: "{{trigger.interactionId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.interactionId}}",
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Reply content",
        supportsVariables: true,
        required: true,
      },
      {
        key: "ephemeral",
        label: "Ephemeral (only visible to user)",
        type: "checkbox",
        defaultValue: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_show_modal",
    fields: [
      {
        key: "interactionId",
        label: "Interaction ID",
        type: "text",
        placeholder: "{{trigger.interactionId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.interactionId}}",
        required: true,
      },
      {
        key: "customId",
        label: "Custom ID",
        type: "text",
        placeholder: "modal_id",
        required: true,
        supportsVariables: false,
      },
      {
        key: "title",
        label: "Modal Title",
        type: "text",
        placeholder: "Modal title",
        supportsVariables: true,
        required: true,
      },
      {
        key: "components",
        label: "Components (JSON array)",
        type: "textarea",
        placeholder: '[{"type":"text_input","customId":"field1","label":"Field"}]',
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_send_components",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Message content",
        supportsVariables: true,
      },
      {
        key: "components",
        label: "Components (JSON array)",
        type: "textarea",
        placeholder: '[{"type":"action_row","components":[{"type":"button","label":"Click me","customId":"btn1"}]}]',
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "discord_edit_interaction",
    fields: [
      {
        key: "interactionId",
        label: "Interaction ID",
        type: "text",
        placeholder: "{{trigger.interactionId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.interactionId}}",
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Updated content",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_defer_reply",
    fields: [
      {
        key: "interactionId",
        label: "Interaction ID",
        type: "text",
        placeholder: "{{trigger.interactionId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.interactionId}}",
        required: true,
      },
      {
        key: "ephemeral",
        label: "Ephemeral",
        type: "checkbox",
        defaultValue: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_set_channel_permissions",
    fields: [
      {
        key: "channelId",
        label: "Channel ID",
        type: "text",
        placeholder: "{{trigger.channelId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.channelId}}",
        required: true,
      },
      {
        key: "targetId",
        label: "Target ID (user or role)",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "targetType",
        label: "Target Type",
        type: "select",
        defaultValue: "member",
        options: [
          { value: "member", label: "Member" },
          { value: "role", label: "Role" },
        ],
      },
      {
        key: "allow",
        label: "Allow (permission bitfield)",
        type: "text",
        placeholder: "0",
        supportsVariables: false,
      },
      {
        key: "deny",
        label: "Deny (permission bitfield)",
        type: "text",
        placeholder: "0",
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  {
    type: "discord_create_forum_post",
    fields: [
      {
        key: "channelId",
        label: "Forum Channel ID",
        type: "text",
        placeholder: "Forum channel ID",
        supportsVariables: true,
        required: true,
      },
      {
        key: "name",
        label: "Post Title",
        type: "text",
        placeholder: "Forum post title",
        supportsVariables: true,
        required: true,
      },
      {
        key: "content",
        label: "Content",
        type: "textarea",
        placeholder: "Forum post content",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "threadId", type: "string" }],
  },

  {
    type: "discord_register_commands",
    fields: [
      {
        key: "commands",
        label: "Commands (JSON array)",
        type: "textarea",
        placeholder: '[{"name":"ping","description":"Ping the bot"}]',
        required: true,
        supportsVariables: false,
      },
      {
        key: "guildId",
        label: "Guild ID (leave empty for global)",
        type: "text",
        placeholder: "Optional guild ID",
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  // =========================================================================
  // GENERAL — Context
  // =========================================================================

  {
    type: "get_context",
    fields: [
      {
        key: "key",
        label: "Context Key",
        type: "text",
        placeholder: "myVariable",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "value", type: "string" }],
  },

  {
    type: "set_context",
    fields: [
      {
        key: "key",
        label: "Context Key",
        type: "text",
        placeholder: "myVariable",
        required: true,
        supportsVariables: false,
      },
      {
        key: "value",
        label: "Value",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "delete_context",
    fields: [
      {
        key: "key",
        label: "Context Key",
        type: "text",
        placeholder: "myVariable",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [],
  },

  {
    type: "context_condition",
    fields: [
      {
        key: "key",
        label: "Context Key",
        type: "text",
        placeholder: "myVariable",
        required: true,
        supportsVariables: false,
      },
      {
        key: "operator",
        label: "Operator",
        type: "select",
        defaultValue: "equals",
        options: [
          { value: "equals", label: "Equals" },
          { value: "not_equals", label: "Not equals" },
          { value: "contains", label: "Contains" },
          { value: "exists", label: "Exists" },
          { value: "not_exists", label: "Not exists" },
        ],
      },
      {
        key: "value",
        label: "Value",
        type: "text",
        placeholder: "Expected value",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "result", type: "boolean" }],
  },

  // =========================================================================
  // GENERAL — Flow Chaining
  // =========================================================================

  {
    type: "run_flow",
    fields: [
      {
        key: "flowId",
        label: "Flow ID",
        type: "text",
        placeholder: "Target flow ID",
        required: true,
        supportsVariables: false,
      },
      {
        key: "payload",
        label: "Payload (JSON)",
        type: "textarea",
        placeholder: '{"key": "value"}',
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "result", type: "object" }],
  },

  {
    type: "emit_event",
    fields: [
      {
        key: "eventName",
        label: "Event Name",
        type: "text",
        placeholder: "custom.event.name",
        required: true,
        supportsVariables: false,
      },
      {
        key: "payload",
        label: "Payload (JSON)",
        type: "textarea",
        placeholder: '{"key": "value"}',
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "custom_event",
    fields: [
      {
        key: "eventName",
        label: "Event Name Filter",
        type: "text",
        placeholder: "custom.event.name",
        required: true,
        supportsVariables: false,
      },
    ],
    outputs: [{ key: "payload", type: "object" }],
  },

  // =========================================================================
  // GENERAL — Utility
  // =========================================================================

  {
    type: "delay",
    fields: [
      {
        key: "delayMs",
        label: "Delay (milliseconds)",
        type: "number",
        defaultValue: 1000,
        validation: { min: 0 },
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "api_call",
    fields: [
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "https://api.example.com/endpoint",
        required: true,
        supportsVariables: true,
      },
      {
        key: "method",
        label: "Method",
        type: "select",
        defaultValue: "GET",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "PATCH", label: "PATCH" },
          { value: "DELETE", label: "DELETE" },
        ],
      },
      {
        key: "headers",
        label: "Headers (JSON)",
        type: "textarea",
        placeholder: '{"Authorization": "Bearer {{context.token}}"}',
        supportsVariables: true,
      },
      {
        key: "body",
        label: "Body (JSON)",
        type: "textarea",
        placeholder: '{"key": "value"}',
        supportsVariables: true,
      },
    ],
    outputs: [
      { key: "status", type: "number" },
      { key: "body", type: "object" },
    ],
  },

  // =========================================================================
  // UNIFIED CROSS-PLATFORM ACTIONS
  // =========================================================================

  {
    type: "unified_send_message",
    fields: [
      {
        key: "chatId",
        label: "Chat / Channel ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "text",
        label: "Text",
        type: "textarea",
        placeholder: "Hello {{trigger.senderName}}!",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "unified_send_media",
    fields: [
      {
        key: "chatId",
        label: "Chat / Channel ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "mediaUrl",
        label: "Media URL",
        type: "text",
        placeholder: "https://example.com/file.jpg",
        supportsVariables: true,
        required: true,
      },
      {
        key: "caption",
        label: "Caption",
        type: "textarea",
        placeholder: "Optional caption",
        supportsVariables: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "unified_delete_message",
    fields: [
      {
        key: "chatId",
        label: "Chat / Channel ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "unified_ban_user",
    fields: [
      {
        key: "chatId",
        label: "Chat / Guild ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional reason",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "unified_kick_user",
    fields: [
      {
        key: "chatId",
        label: "Chat / Guild ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "reason",
        label: "Reason",
        type: "text",
        placeholder: "Optional reason",
        supportsVariables: true,
      },
    ],
    outputs: [],
  },

  {
    type: "unified_pin_message",
    fields: [
      {
        key: "chatId",
        label: "Chat / Channel ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "messageId",
        label: "Message ID",
        type: "text",
        placeholder: "{{trigger.messageId}}",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [],
  },

  {
    type: "unified_send_dm",
    fields: [
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "text",
        label: "Text",
        type: "textarea",
        placeholder: "Direct message content",
        supportsVariables: true,
        required: true,
      },
    ],
    outputs: [{ key: "messageId", type: "string" }],
  },

  {
    type: "unified_set_role",
    fields: [
      {
        key: "chatId",
        label: "Chat / Guild ID",
        type: "text",
        placeholder: "{{trigger.chatId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.chatId}}",
        required: true,
      },
      {
        key: "userId",
        label: "User ID",
        type: "text",
        placeholder: "{{trigger.userId}}",
        supportsVariables: true,
        defaultValue: "{{trigger.userId}}",
        required: true,
      },
      {
        key: "role",
        label: "Role / Permission Level",
        type: "text",
        placeholder: "admin",
        supportsVariables: false,
        required: true,
      },
    ],
    outputs: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const SCHEMA_MAP = new Map<string, NodeTypeSchema>(
  NODE_FIELD_SCHEMAS.map((s) => [s.type, s as NodeTypeSchema]),
);

export function getNodeSchema(type: string): NodeTypeSchema | undefined {
  return SCHEMA_MAP.get(type);
}

export function getNodeOutputs(type: string): ReadonlyArray<NodeOutputSchema> {
  return SCHEMA_MAP.get(type)?.outputs ?? [];
}
