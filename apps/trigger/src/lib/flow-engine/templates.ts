import type { FlowNode, FlowEdge } from './types.js';

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'welcome-flow',
    name: 'Welcome New Members',
    description: 'Send a welcome message when a user joins the group',
    category: 'community',
    nodes: [
      {
        id: 'trigger-1',
        type: 'user_joins',
        category: 'trigger',
        label: 'User Joins',
        config: {},
      },
      {
        id: 'action-1',
        type: 'send_message',
        category: 'action',
        label: 'Send Welcome',
        config: {
          chatId: '{{trigger.chatId}}',
          text: 'Welcome {{trigger.userName}}! Please read the rules.',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'action-1' },
    ],
  },
  {
    id: 'spam-escalation',
    name: 'Spam Escalation',
    description: 'Detect spam keywords and escalate with mute/ban',
    category: 'moderation',
    nodes: [
      {
        id: 'trigger-1',
        type: 'message_received',
        category: 'trigger',
        label: 'Message Received',
        config: {},
      },
      {
        id: 'condition-1',
        type: 'keyword_match',
        category: 'condition',
        label: 'Spam Keywords',
        config: { keywords: ['buy now', 'free money', 'click here'], mode: 'any' },
      },
      {
        id: 'action-1',
        type: 'mute_user',
        category: 'action',
        label: 'Mute Spammer',
        config: {
          chatId: '{{trigger.chatId}}',
          userId: '{{trigger.userId}}',
          durationSeconds: 3600,
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger-1', target: 'condition-1' },
      { id: 'e2', source: 'condition-1', target: 'action-1' },
    ],
  },
];

export function getTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}
