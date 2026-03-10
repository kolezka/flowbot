export interface FlowContext {
  flowId: string;
  executionId: string;
  variables: Map<string, unknown>;
  triggerData: Record<string, unknown>;
  nodeResults: Map<string, NodeResult>;
}

export interface NodeResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface FlowNode {
  id: string;
  type: string;
  category: string;
  label: string;
  config: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export type ErrorHandling = 'stop' | 'skip' | 'retry';
