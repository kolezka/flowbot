export interface ModerationEvent {
  type: 'warning.created' | 'warning.deactivated' | 'member.banned' | 'member.muted' | 'member.unbanned' | 'log.created';
  groupId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface AutomationEvent {
  type: 'broadcast.created' | 'broadcast.completed' | 'broadcast.failed' | 'job.started' | 'job.completed' | 'job.failed';
  jobId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface SystemEvent {
  type: 'health.update';
  data: Record<string, unknown>;
  timestamp: Date;
}

export type AppEvent = ModerationEvent | AutomationEvent | SystemEvent;
