export interface ModerationEvent {
  type:
    | 'warning.created'
    | 'warning.deactivated'
    | 'member.banned'
    | 'member.muted'
    | 'member.unbanned'
    | 'log.created';
  groupId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface SystemEvent {
  type: 'health.update';
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface QrAuthEvent {
  type: 'qr' | 'connected' | 'error' | 'timeout';
  connectionId: string;
  qr?: string; // base64 QR code
  pushName?: string;
  phoneNumber?: string;
  error?: string;
}

export interface ExecutionUpdateEvent {
  executionId: string;
  nodeId: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  variables?: Record<string, unknown>;
  output?: unknown;
  duration?: number;
  error?: string;
}

export type AppEvent =
  | ModerationEvent
  | SystemEvent
  | QrAuthEvent
  | ExecutionUpdateEvent;
