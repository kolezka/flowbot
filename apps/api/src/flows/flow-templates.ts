/**
 * Predefined flow templates that users can instantiate from the dashboard.
 *
 * Each template stores nodes in the React Flow format (type: "default", data.nodeType, etc.)
 * so the editor can load them directly without conversion.
 */

const CATEGORY_COLORS: Record<string, string> = {
  trigger: '#22c55e',
  condition: '#eab308',
  action: '#3b82f6',
  advanced: '#8b5cf6',
};

interface TemplateNode {
  id: string;
  type: 'default';
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string;
    category: string;
    config: Record<string, unknown>;
  };
  style: {
    border: string;
    borderRadius: number;
    padding: number;
    minWidth: number;
  };
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

function node(
  id: string,
  nodeType: string,
  label: string,
  category: string,
  config: Record<string, unknown>,
  x: number,
  y: number,
): TemplateNode {
  return {
    id,
    type: 'default',
    position: { x, y },
    data: { label, nodeType, category, config },
    style: {
      border: `2px solid ${CATEGORY_COLORS[category] ?? '#888'}`,
      borderRadius: 8,
      padding: 8,
      minWidth: 150,
    },
  };
}

function edge(id: string, source: string, target: string): TemplateEdge {
  return { id, source, target };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const FLOW_TEMPLATES: FlowTemplate[] = [
  // 1. Command → Reply
  {
    id: 'command-reply',
    name: 'Command Reply',
    description:
      'Reply with a message when a bot command is received (e.g. /test → "Hello World")',
    category: 'basics',
    platform: 'telegram',
    nodes: [
      node(
        'trigger-1',
        'command_received',
        'Command',
        'trigger',
        { command: 'test' },
        250,
        50,
      ),
      node(
        'action-1',
        'send_message',
        'Send Reply',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          text: 'Hello World! 👋',
          parseMode: 'HTML',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 2. Welcome New Members
  {
    id: 'welcome-flow',
    name: 'Welcome New Members',
    description: 'Send a welcome message when a user joins the group',
    category: 'community',
    platform: 'telegram',
    nodes: [
      node('trigger-1', 'user_joins', 'User Joins', 'trigger', {}, 250, 50),
      node(
        'action-1',
        'send_message',
        'Send Welcome',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          text: 'Welcome {{trigger.userName}}! Please read the pinned rules.',
          parseMode: 'HTML',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 3. Spam Escalation
  {
    id: 'spam-escalation',
    name: 'Spam Filter',
    description: 'Detect spam keywords and mute the sender',
    category: 'moderation',
    platform: 'telegram',
    nodes: [
      node(
        'trigger-1',
        'message_received',
        'Message Received',
        'trigger',
        {},
        250,
        50,
      ),
      node(
        'condition-1',
        'keyword_match',
        'Spam Keywords',
        'condition',
        {
          keywords: ['buy now', 'free money', 'click here', 'limited offer'],
          mode: 'any',
        },
        250,
        200,
      ),
      node(
        'action-1',
        'mute_user',
        'Mute Spammer',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          userId: '{{trigger.userId}}',
          durationSeconds: 3600,
        },
        250,
        350,
      ),
    ],
    edges: [
      edge('e1', 'trigger-1', 'condition-1'),
      edge('e2', 'condition-1', 'action-1'),
    ],
  },

  // 4. Auto-Reply by Keyword
  {
    id: 'auto-reply',
    name: 'Auto-Reply by Keyword',
    description:
      'Automatically reply when a message matches specific keywords (e.g. FAQ)',
    category: 'basics',
    platform: 'telegram',
    nodes: [
      node(
        'trigger-1',
        'message_received',
        'Message Received',
        'trigger',
        {},
        250,
        50,
      ),
      node(
        'condition-1',
        'keyword_match',
        'FAQ Keywords',
        'condition',
        {
          keywords: ['help', 'info', 'how to'],
          mode: 'any',
        },
        250,
        200,
      ),
      node(
        'action-1',
        'send_message',
        'Send FAQ Reply',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          text: 'Here are some helpful links:\n\n1. Getting started: ...\n2. FAQ: ...\n3. Contact support: ...',
          parseMode: 'HTML',
        },
        250,
        350,
      ),
    ],
    edges: [
      edge('e1', 'trigger-1', 'condition-1'),
      edge('e2', 'condition-1', 'action-1'),
    ],
  },

  // 7. Admin Notification on Join
  {
    id: 'admin-join-notify',
    name: 'Admin Join Notification',
    description: 'Notify admins via DM when a new user joins the group',
    category: 'community',
    platform: 'telegram',
    nodes: [
      node('trigger-1', 'user_joins', 'User Joins', 'trigger', {}, 250, 50),
      node(
        'action-1',
        'send_message',
        'Notify Admin',
        'action',
        {
          chatId: '',
          text: 'New member joined: {{trigger.userName}} (ID: {{trigger.userId}}) in chat {{trigger.chatId}}',
          parseMode: 'HTML',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 8. Goodbye Message
  {
    id: 'goodbye-flow',
    name: 'Goodbye Message',
    description: 'Send a farewell message when a user leaves the group',
    category: 'community',
    platform: 'telegram',
    nodes: [
      node('trigger-1', 'user_leaves', 'User Leaves', 'trigger', {}, 250, 50),
      node(
        'action-1',
        'send_message',
        'Send Goodbye',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          text: 'Goodbye {{trigger.userName}}, we hope to see you again!',
          parseMode: 'HTML',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 9. Button Menu
  {
    id: 'button-menu',
    name: 'Interactive Button Menu',
    description:
      'Show an inline keyboard menu on /menu command, respond to button clicks',
    category: 'basics',
    platform: 'telegram',
    nodes: [
      node(
        'trigger-1',
        'command_received',
        'Command /menu',
        'trigger',
        { command: 'menu' },
        250,
        50,
      ),
      node(
        'action-1',
        'send_message',
        'Show Menu',
        'action',
        {
          chatId: '{{trigger.chatId}}',
          text: 'Choose an option:',
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [{ text: 'Option A', callback_data: 'opt_a' }],
              [{ text: 'Option B', callback_data: 'opt_b' }],
            ],
          },
        },
        250,
        200,
      ),
      node(
        'trigger-2',
        'callback_query',
        'Button Click',
        'trigger',
        {},
        250,
        400,
      ),
      node(
        'action-2',
        'answer_callback_query',
        'Acknowledge',
        'action',
        {
          callbackQueryId: '{{trigger.callbackQueryId}}',
          text: 'You selected: {{trigger.callbackData}}',
        },
        250,
        550,
      ),
    ],
    edges: [
      edge('e1', 'trigger-1', 'action-1'),
      edge('e2', 'trigger-2', 'action-2'),
    ],
  },

  // 10. Webhook → Notification
  {
    id: 'webhook-notify',
    name: 'Webhook Notification',
    description:
      'Receive an external webhook and forward a notification to a chat',
    category: 'automation',
    platform: 'telegram',
    nodes: [
      node('trigger-1', 'webhook', 'Webhook Received', 'trigger', {}, 250, 50),
      node(
        'action-1',
        'send_message',
        'Send Notification',
        'action',
        {
          chatId: '',
          text: 'Webhook event received:\n{{trigger.body}}',
          parseMode: 'HTML',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 11. Discord Welcome
  {
    id: 'discord-welcome',
    name: 'Discord Welcome',
    description: 'Welcome new members in a Discord server',
    category: 'community',
    platform: 'discord',
    nodes: [
      node(
        'trigger-1',
        'discord_member_join',
        'Member Joins',
        'trigger',
        {},
        250,
        50,
      ),
      node(
        'action-1',
        'discord_send_message',
        'Send Welcome',
        'action',
        {
          channelId: '',
          content:
            'Welcome to the server, {{trigger.userName}}! Check out #rules to get started.',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },

  // 12. Discord Slash Command
  {
    id: 'discord-slash-command',
    name: 'Discord Slash Command',
    description: 'Respond to a Discord slash command with a message',
    category: 'basics',
    platform: 'discord',
    nodes: [
      node(
        'trigger-1',
        'discord_slash_command',
        'Slash Command',
        'trigger',
        { command: 'hello' },
        250,
        50,
      ),
      node(
        'action-1',
        'discord_reply_interaction',
        'Reply',
        'action',
        {
          content: 'Hello World!',
        },
        250,
        200,
      ),
    ],
    edges: [edge('e1', 'trigger-1', 'action-1')],
  },
];

export function getFlowTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}
