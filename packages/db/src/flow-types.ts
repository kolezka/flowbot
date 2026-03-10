export enum FlowNodeType {
  // Triggers
  MESSAGE_RECEIVED = 'message_received',
  USER_JOINS = 'user_joins',
  SCHEDULE = 'schedule',
  WEBHOOK = 'webhook',

  // Conditions
  KEYWORD_MATCH = 'keyword_match',
  USER_ROLE = 'user_role',
  TIME_BASED = 'time_based',

  // Actions
  SEND_MESSAGE = 'send_message',
  FORWARD_MESSAGE = 'forward_message',
  BAN_USER = 'ban_user',
  MUTE_USER = 'mute_user',
  API_CALL = 'api_call',
  DELAY = 'delay',
}

export type FlowNodeCategory = 'trigger' | 'condition' | 'action';

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
  [FlowNodeType.MESSAGE_RECEIVED]: 'trigger',
  [FlowNodeType.USER_JOINS]: 'trigger',
  [FlowNodeType.SCHEDULE]: 'trigger',
  [FlowNodeType.WEBHOOK]: 'trigger',
  [FlowNodeType.KEYWORD_MATCH]: 'condition',
  [FlowNodeType.USER_ROLE]: 'condition',
  [FlowNodeType.TIME_BASED]: 'condition',
  [FlowNodeType.SEND_MESSAGE]: 'action',
  [FlowNodeType.FORWARD_MESSAGE]: 'action',
  [FlowNodeType.BAN_USER]: 'action',
  [FlowNodeType.MUTE_USER]: 'action',
  [FlowNodeType.API_CALL]: 'action',
  [FlowNodeType.DELAY]: 'action',
};
