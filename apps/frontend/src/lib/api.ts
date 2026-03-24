import { getToken, clearToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  lastChatId?: string;
  lastSeenAt?: string;
  lastMessageAt?: string;
  verifiedAt?: string;
  isBanned: boolean;
  bannedAt?: string;
  banReason?: string;
  messageCount: number;
  commandCount: number;
  referralCode?: string;
  referredByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatsResponse {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  newUsersToday: number;
  verifiedUsers: number;
  totalMessages: number;
  totalCommands: number;
}

// Unified profile interfaces
export interface UnifiedProfile {
  telegramId: string;
  reputationScore: number;
  firstSeenAt: string;
  user?: {
    id: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    languageCode?: string;
    isBanned: boolean;
    banReason?: string;
    messageCount: number;
    commandCount: number;
    verifiedAt?: string;
    createdAt: string;
  };
  memberships: GroupMembership[];
  moderationLogs: ModerationLogEntry[];
}

export interface GroupMembership {
  groupId: string;
  chatId: string;
  title?: string;
  role: string;
  joinedAt: string;
  messageCount: number;
  lastSeenAt: string;
  activeWarnings: ProfileWarning[];
}

export interface ProfileWarning {
  id: string;
  reason?: string;
  issuerId: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
}

export interface ModerationLogEntry {
  id: string;
  action: string;
  actorId: string;
  reason?: string;
  details?: any;
  automated: boolean;
  createdAt: string;
  groupTitle?: string;
}

// Moderation interfaces
export interface ManagedGroup {
  id: string;
  chatId: string;
  title?: string;
  type: string;
  joinedAt: string;
  isActive: boolean;
  memberCount: number;
  config: GroupConfig;
  createdAt: string;
  updatedAt: string;
}

export interface GroupConfig {
  // Welcome & Rules
  welcomeEnabled: boolean;
  welcomeMessage?: string;
  rulesText?: string;

  // Warning System
  warnThresholdMute: number;
  warnThresholdBan: number;
  warnDecayDays: number;
  defaultMuteDurationS: number;

  // Anti-Spam
  antiSpamEnabled: boolean;
  antiSpamMaxMessages: number;
  antiSpamWindowSeconds: number;

  // Anti-Link
  antiLinkEnabled: boolean;
  antiLinkWhitelist: string[];

  // Moderation & Logging
  slowModeDelay: number;
  logChannelId?: string;
  autoDeleteCommandsS: number;

  // CAPTCHA
  captchaEnabled: boolean;
  captchaMode: string;
  captchaTimeoutS: number;

  // Quarantine
  quarantineEnabled: boolean;
  quarantineDurationS: number;

  // Content Filtering
  silentMode: boolean;
  keywordFiltersEnabled: boolean;
  keywordFilters: string[];
  aiModEnabled: boolean;
  aiModThreshold: number;

  // Notifications & Pipeline
  notificationEvents: string[];
  pipelineEnabled: boolean;
  pipelineDmTemplate?: string;
  pipelineDeeplink?: string;
}

export interface GroupsResponse {
  data: ManagedGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ModerationLog {
  id: string;
  groupId: string;
  action: string;
  actorId: string;
  targetId?: string;
  reason?: string;
  details?: Record<string, unknown>;
  automated: boolean;
  createdAt: string;
  group?: { title?: string };
}

export interface ModerationLogsResponse {
  data: ModerationLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ModerationLogStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  recentActions: number;
  automatedCount: number;
}

export interface Warning {
  id: string;
  groupId: string;
  userId: string;
  issuerId: string;
  reason?: string;
  isActive: boolean;
  expiresAt?: string;
  deactivatedAt?: string;
  createdAt: string;
  group?: { title?: string };
}

export interface WarningsResponse {
  data: Warning[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WarningStats {
  totalWarnings: number;
  activeWarnings: number;
  expiredWarnings: number;
  deactivatedWarnings: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  joinedAt: string;
  messageCount: number;
  lastSeenAt: string;
  warningCount: number;
  isQuarantined: boolean;
  quarantineExpiresAt?: string;
}

export interface GroupMembersResponse {
  data: GroupMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Analytics interfaces
export interface AnalyticsSnapshot {
  date: string;
  memberCount: number;
  newMembers: number;
  leftMembers: number;
  messageCount: number;
  spamDetected: number;
  linksBlocked: number;
  warningsIssued: number;
  mutesIssued: number;
  bansIssued: number;
  deletedMessages: number;
}

export interface AnalyticsTimeSeries {
  groupId: string;
  data: AnalyticsSnapshot[];
}

export interface AggregatedPeriod {
  totalMessages: number;
  totalSpam: number;
  totalLinksBlocked: number;
  totalWarnings: number;
  totalMutes: number;
  totalBans: number;
  totalDeleted: number;
  memberGrowth: number;
}

export interface AnalyticsSummary {
  groupId: string;
  groupTitle: string;
  currentMemberCount: number;
  last7d: AggregatedPeriod;
  last30d: AggregatedPeriod;
  allTime: AggregatedPeriod;
}

export interface GroupOverviewItem {
  groupId: string;
  title: string;
  memberCount: number;
  messagesToday: number;
  spamToday: number;
  moderationToday: number;
}

export interface AnalyticsOverview {
  totalGroups: number;
  totalMembers: number;
  totalMessagesToday: number;
  totalSpamToday: number;
  totalModerationToday: number;
  groups: GroupOverviewItem[];
}

// Scheduled Messages interfaces
export interface ScheduledMessage {
  id: string;
  groupId: string;
  groupTitle?: string;
  chatId: string;
  text: string;
  createdBy: string;
  sendAt: string;
  sent: boolean;
  sentAt?: string;
  createdAt: string;
}

export interface ScheduledMessageListResponse {
  data: ScheduledMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// CrossPost Templates interfaces
export interface CrossPostTemplate {
  id: string;
  name: string;
  messageText: string;
  targetChatIds: string[];
  targetGroupNames: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrossPostTemplateListResponse {
  data: CrossPostTemplate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


// System Status interfaces
export interface SystemComponent {
  name: string;
  status: 'up' | 'degraded' | 'down' | 'unreachable';
  uptime?: number;
  lastChecked: string;
  error?: string;
}

export interface SystemStatus {
  overall: 'up' | 'degraded' | 'down';
  components: SystemComponent[];
  lastChecked: string;
}

export interface WorkerInstance {
  instanceId: string;
  pool: string;
  status: string;
  health: {
    connected: boolean;
    uptime: number;
    actionCount: number;
    errorCount: number;
  } | null;
}

export interface SystemWorkers {
  instances: WorkerInstance[];
}

// Bot Config interfaces
export interface BotInstance {
  id: string;
  name: string;
  botToken?: string | null;
  botUsername?: string;
  platform?: string;
  type: string;
  apiUrl?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  configVersion?: number;
  _count?: { commands: number; responses: number; menus: number };
  commands?: BotCommand[];
  responses?: BotResponse[];
  menus?: BotMenu[];
  createdAt: string;
  updatedAt: string;
}

export interface BotCommand {
  id: string;
  botId: string;
  command: string;
  description?: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BotResponse {
  id: string;
  botId: string;
  key: string;
  locale: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotMenu {
  id: string;
  botId: string;
  name: string;
  buttons: BotMenuButton[];
  createdAt: string;
  updatedAt: string;
}

export interface BotMenuButton {
  id: string;
  menuId: string;
  label: string;
  action: string;
  row: number;
  col: number;
  createdAt: string;
  updatedAt: string;
}

// Bot Config version history
export interface BotConfigVersion {
  version: number;
  publishedAt: string;
  publishedBy?: string;
}

// Bot i18n string
export interface BotI18nString {
  id: string;
  botId: string;
  key: string;
  locale: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

// TG Client interfaces
export interface TgClientSession {
  id: string;
  isActive: boolean;
  lastUsedAt: string;
  phoneNumber?: string;
  displayName?: string;
  dcId?: number;
  sessionType: string;
  errorCount: number;
  lastError?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TgClientSessionsResponse {
  data: TgClientSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransportHealth {
  activeSessions: number;
  errorSessions: number;
  healthySessions: number;
  recentLogs: Array<{ id: string; level: string; message: string; details?: any; createdAt: string }>;
  lastChecked: string;
}

// Flow interfaces
export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  nodesJson: any[];
  edgesJson: any[];
  transportConfig?: { transport: string; botInstanceId?: string; discordBotInstanceId?: string };
  platform?: string;
  status: string;
  version: number;
  _count?: { executions: number };
  createdAt: string;
  updatedAt: string;
}

export interface FlowsResponse {
  data: FlowDefinition[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FlowExecution {
  id: string;
  flowId: string;
  status: string;
  triggerData?: any;
  nodeResults?: any;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface FlowValidation {
  valid: boolean;
  errors: string[];
}

export interface FlowVersion {
  id: string;
  flowId: string;
  version: number;
  nodesJson: any[];
  edgesJson: any[];
  createdBy?: string;
  createdAt: string;
}

export interface FlowAnalytics {
  totalExecutions: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  avgDurationMs: number;
  errorRate: number;
  commonErrors: Array<{ error: string; count: number }>;
}

export interface FlowGlobalAnalytics {
  totalExecutions: number;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  activeFlowsCount: number;
  totalFlowsCount: number;
  avgDurationMs: number;
  successRate: number;
  dailyStats: Array<{ date: string; total: number; completed: number; failed: number }>;
  topFlows: Array<{ flowId: string; name: string; status: string; executions: number; successRate: number }>;
  commonErrors: Array<{ error: string; count: number }>;
}

// Webhook interfaces
export interface WebhookEndpoint {
  id: string;
  name: string;
  token: string;
  flowId?: string;
  isActive: boolean;
  lastCalledAt?: string;
  callCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  message: string;
  status?: number;
}

// Connection types
export interface PlatformConnectionType {
  id: string;
  platform: string;
  name: string;
  connectionType: string;
  status: string;
  metadata?: Record<string, unknown>;
  errorCount: number;
  lastErrorMessage?: string;
  lastActiveAt?: string;
  botInstanceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionHealth {
  totalConnections: number;
  activeConnections: number;
  errorConnections: number;
  platforms: Record<string, { total: number; active: number; error: number }>;
}

export interface ConnectionLog {
  id: string;
  connectionId: string;
  level: string;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface ConnectionsResponse {
  data: PlatformConnectionType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConnectionLogsResponse {
  data: ConnectionLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Platform Account types
export interface PlatformAccount {
  id: string;
  platform: string;
  platformUserId: string;
  identityId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
  isBanned: boolean;
  bannedAt?: string;
  banReason?: string;
  messageCount: number;
  commandCount: number;
  isVerified: boolean;
  verifiedAt?: string;
  lastSeenAt?: string;
  lastMessageAt?: string;
  referralCode?: string;
  referredByAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserIdentity {
  id: string;
  displayName?: string;
  email?: string;
  platformAccounts: PlatformAccount[];
  createdAt: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Clear invalid token and redirect to login
        clearToken();
        if (typeof window !== 'undefined' && !endpoint.includes('/api/auth/')) {
          window.location.href = '/login';
        }
        const error: ApiError = {
          message: 'Unauthorized',
          status: 401,
        };
        throw error;
      }

      if (!response.ok) {
        const error: ApiError = {
          message: `HTTP error! status: ${response.status}`,
          status: response.status,
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        throw { message: 'Network error. Please check your connection.' };
      }
      throw error;
    }
  }

  async login(password: string): Promise<{ token: string }> {
    return this.request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  }

  async verifyToken(): Promise<{ valid: boolean }> {
    return this.request<{ valid: boolean }>('/api/auth/verify', {
      method: 'POST',
    });
  }

  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('/api/users/stats');
  }

  async getUsers(page: number = 1, limit: number = 10, search?: string): Promise<UsersResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (search) {
      params.append('search', search);
    }

    return this.request<UsersResponse>(`/api/users?${params.toString()}`);
  }

  async getUser(id: string): Promise<User> {
    return this.request<User>(`/api/users/${id}`);
  }

  async getUnifiedProfile(telegramId: string): Promise<UnifiedProfile> {
    return this.request<UnifiedProfile>(`/api/users/${telegramId}/profile`);
  }

  async setBanStatus(id: string, isBanned: boolean, banReason?: string): Promise<User> {
    return this.request<User>(`/api/users/${id}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ isBanned, banReason }),
    });
  }

  // Moderation - Groups
  async getGroups(params?: { page?: number; limit?: number; search?: string; isActive?: boolean }): Promise<GroupsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    const qs = searchParams.toString();
    return this.request<GroupsResponse>(`/api/groups${qs ? `?${qs}` : ''}`);
  }

  async getGroup(id: string): Promise<ManagedGroup> {
    return this.request<ManagedGroup>(`/api/groups/${id}`);
  }

  async updateGroupConfig(id: string, data: Partial<GroupConfig>): Promise<ManagedGroup> {
    return this.request<ManagedGroup>(`/api/groups/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Moderation - Logs
  async getModerationLogs(params?: {
    page?: number; limit?: number; groupId?: string; action?: string;
    actorId?: string; targetId?: string; startDate?: string; endDate?: string;
  }): Promise<ModerationLogsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.groupId) searchParams.append('groupId', params.groupId);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.actorId) searchParams.append('actorId', params.actorId);
    if (params?.targetId) searchParams.append('targetId', params.targetId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString();
    return this.request<ModerationLogsResponse>(`/api/moderation/logs${qs ? `?${qs}` : ''}`);
  }

  async getModerationLogStats(params?: { groupId?: string; startDate?: string; endDate?: string }): Promise<ModerationLogStats> {
    const searchParams = new URLSearchParams();
    if (params?.groupId) searchParams.append('groupId', params.groupId);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const qs = searchParams.toString();
    return this.request<ModerationLogStats>(`/api/moderation/logs/stats${qs ? `?${qs}` : ''}`);
  }

  // Moderation - Warnings
  async getWarnings(params?: {
    page?: number; limit?: number; groupId?: string; userId?: string; isActive?: boolean;
  }): Promise<WarningsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.groupId) searchParams.append('groupId', params.groupId);
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    const qs = searchParams.toString();
    return this.request<WarningsResponse>(`/api/warnings${qs ? `?${qs}` : ''}`);
  }

  async deactivateWarning(id: string): Promise<Warning> {
    return this.request<Warning>(`/api/warnings/${id}`, {
      method: 'DELETE',
    });
  }

  async getWarningStats(): Promise<WarningStats> {
    return this.request<WarningStats>('/api/warnings/stats');
  }

  // Moderation - Group Members
  async getGroupMembers(groupId: string, params?: {
    page?: number; limit?: number; search?: string; role?: string; isQuarantined?: boolean;
  }): Promise<GroupMembersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.role) searchParams.append('role', params.role);
    if (params?.isQuarantined !== undefined) searchParams.append('isQuarantined', params.isQuarantined.toString());
    const qs = searchParams.toString();
    return this.request<GroupMembersResponse>(`/api/moderation/groups/${groupId}/members${qs ? `?${qs}` : ''}`);
  }

  async releaseMember(groupId: string, memberId: string): Promise<GroupMember> {
    return this.request<GroupMember>(`/api/moderation/groups/${groupId}/members/${memberId}/release`, {
      method: 'POST',
    });
  }

  async getGroupMember(groupId: string, memberId: string): Promise<GroupMember> {
    return this.request<GroupMember>(`/api/moderation/groups/${groupId}/members/${memberId}`);
  }

  async updateMemberRole(groupId: string, memberId: string, role: string): Promise<GroupMember> {
    return this.request<GroupMember>(`/api/moderation/groups/${groupId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async warnMember(groupId: string, memberId: string, data?: { reason?: string }): Promise<void> {
    await this.request<void>(`/api/moderation/groups/${groupId}/members/${memberId}/warn`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async muteMember(groupId: string, memberId: string, data: { duration: number; reason?: string }): Promise<void> {
    await this.request<void>(`/api/moderation/groups/${groupId}/members/${memberId}/mute`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async banMember(groupId: string, memberId: string, data?: { reason?: string }): Promise<void> {
    await this.request<void>(`/api/moderation/groups/${groupId}/members/${memberId}/ban`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async unbanMember(groupId: string, memberId: string): Promise<void> {
    await this.request<void>(`/api/moderation/groups/${groupId}/members/${memberId}/unban`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Analytics
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return this.request<AnalyticsOverview>('/api/analytics/overview');
  }

  async getAnalyticsTimeSeries(groupId: string, params?: {
    from?: string; to?: string; granularity?: string;
  }): Promise<AnalyticsTimeSeries> {
    const searchParams = new URLSearchParams();
    if (params?.from) searchParams.append('from', params.from);
    if (params?.to) searchParams.append('to', params.to);
    if (params?.granularity) searchParams.append('granularity', params.granularity);
    const qs = searchParams.toString();
    return this.request<AnalyticsTimeSeries>(`/api/analytics/groups/${groupId}${qs ? `?${qs}` : ''}`);
  }

  async getAnalyticsSummary(groupId: string): Promise<AnalyticsSummary> {
    return this.request<AnalyticsSummary>(`/api/analytics/groups/${groupId}/summary`);
  }

  // Scheduled Messages
  async getScheduledMessages(params?: {
    page?: number; limit?: number; groupId?: string; sent?: boolean;
  }): Promise<ScheduledMessageListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.groupId) searchParams.append('groupId', params.groupId);
    if (params?.sent !== undefined) searchParams.append('sent', params.sent.toString());
    const qs = searchParams.toString();
    return this.request<ScheduledMessageListResponse>(
      `/api/moderation/scheduled-messages${qs ? `?${qs}` : ''}`
    );
  }

  async createScheduledMessage(data: {
    groupId: string; text: string; sendAt: string;
  }): Promise<ScheduledMessage> {
    return this.request<ScheduledMessage>('/api/moderation/scheduled-messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteScheduledMessage(id: string): Promise<void> {
    await this.request<void>(`/api/moderation/scheduled-messages/${id}`, {
      method: 'DELETE',
    });
  }

  // CrossPost Templates
  async getCrossPostTemplates(params?: {
    page?: number; limit?: number; isActive?: boolean;
  }): Promise<CrossPostTemplateListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
    const qs = searchParams.toString();
    return this.request<CrossPostTemplateListResponse>(
      `/api/moderation/crosspost-templates${qs ? `?${qs}` : ''}`
    );
  }

  async createCrossPostTemplate(data: {
    name: string; messageText: string; targetChatIds: string[]; isActive?: boolean;
  }): Promise<CrossPostTemplate> {
    return this.request<CrossPostTemplate>('/api/moderation/crosspost-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCrossPostTemplate(id: string, data: {
    name?: string; messageText?: string; targetChatIds?: string[]; isActive?: boolean;
  }): Promise<CrossPostTemplate> {
    return this.request<CrossPostTemplate>(`/api/moderation/crosspost-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCrossPostTemplate(id: string): Promise<void> {
    await this.request<void>(`/api/moderation/crosspost-templates/${id}`, {
      method: 'DELETE',
    });
  }

  // System Status
  async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/api/system/status');
  }

  async getSystemWorkers(): Promise<SystemWorkers> {
    return this.request<SystemWorkers>('/api/system/workers');
  }

  // Bot Config
  async getBotInstances(platformOrParams?: string | { platform?: string }): Promise<BotInstance[]> {
    let platformValue: string | undefined;
    if (typeof platformOrParams === 'string') {
      platformValue = platformOrParams;
    } else {
      platformValue = platformOrParams?.platform;
    }
    const qs = platformValue ? `?platform=${encodeURIComponent(platformValue)}` : '';
    return this.request<BotInstance[]>(`/api/bot-config${qs}`);
  }

  async getBotInstance(botId: string): Promise<BotInstance> {
    return this.request<BotInstance>(`/api/bot-config/${botId}`);
  }

  async createBotInstance(data: { name: string; botToken?: string; botUsername?: string; platform?: string; type?: string }): Promise<BotInstance> {
    return this.request<BotInstance>('/api/bot-config', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBotInstance(botId: string, data: { name?: string; botUsername?: string; isActive?: boolean }): Promise<BotInstance> {
    return this.request<BotInstance>(`/api/bot-config/${botId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteBotInstance(botId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}`, { method: 'DELETE' });
  }

  async getBotCommands(botId: string): Promise<BotCommand[]> {
    return this.request<BotCommand[]>(`/api/bot-config/${botId}/commands`);
  }

  async createBotCommand(botId: string, data: { command: string; description?: string }): Promise<BotCommand> {
    return this.request<BotCommand>(`/api/bot-config/${botId}/commands`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBotCommand(botId: string, commandId: string, data: { description?: string; isEnabled?: boolean; sortOrder?: number }): Promise<BotCommand> {
    return this.request<BotCommand>(`/api/bot-config/${botId}/commands/${commandId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteBotCommand(botId: string, commandId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}/commands/${commandId}`, { method: 'DELETE' });
  }

  async getBotResponses(botId: string, locale?: string): Promise<BotResponse[]> {
    const params = locale ? `?locale=${locale}` : '';
    return this.request<BotResponse[]>(`/api/bot-config/${botId}/responses${params}`);
  }

  async createBotResponse(botId: string, data: { key: string; locale?: string; text: string }): Promise<BotResponse> {
    return this.request<BotResponse>(`/api/bot-config/${botId}/responses`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBotResponse(botId: string, responseId: string, data: { text: string }): Promise<BotResponse> {
    return this.request<BotResponse>(`/api/bot-config/${botId}/responses/${responseId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteBotResponse(botId: string, responseId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}/responses/${responseId}`, { method: 'DELETE' });
  }

  async getBotMenus(botId: string): Promise<BotMenu[]> {
    return this.request<BotMenu[]>(`/api/bot-config/${botId}/menus`);
  }

  async createBotMenu(botId: string, data: { name: string }): Promise<BotMenu> {
    return this.request<BotMenu>(`/api/bot-config/${botId}/menus`, { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteBotMenu(botId: string, menuId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}/menus/${menuId}`, { method: 'DELETE' });
  }

  async updateBotMenu(botId: string, menuId: string, data: { name?: string }): Promise<BotMenu> {
    return this.request<BotMenu>(`/api/bot-config/${botId}/menus/${menuId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async createMenuButton(botId: string, menuId: string, data: { label: string; action: string; row: number; col: number }): Promise<BotMenuButton> {
    return this.request<BotMenuButton>(`/api/bot-config/${botId}/menus/${menuId}/buttons`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateMenuButton(botId: string, menuId: string, buttonId: string, data: { label?: string; action?: string; row?: number; col?: number }): Promise<BotMenuButton> {
    return this.request<BotMenuButton>(`/api/bot-config/${botId}/menus/${menuId}/buttons/${buttonId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteMenuButton(botId: string, menuId: string, buttonId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}/menus/${menuId}/buttons/${buttonId}`, { method: 'DELETE' });
  }

  async reorderBotCommands(botId: string, commandIds: string[]): Promise<BotCommand[]> {
    return this.request<BotCommand[]>(`/api/bot-config/${botId}/commands/reorder`, { method: 'POST', body: JSON.stringify({ commandIds }) });
  }

  async publishBotConfig(botId: string): Promise<{ version: number }> {
    return this.request<{ version: number }>(`/api/bot-config/${botId}/publish`, { method: 'POST' });
  }

  async getBotConfigVersions(botId: string): Promise<BotConfigVersion[]> {
    return this.request<BotConfigVersion[]>(`/api/bot-config/${botId}/versions`);
  }

  async getBotI18nStrings(botId: string, locale?: string): Promise<BotI18nString[]> {
    const params = locale ? `?locale=${locale}` : '';
    return this.request<BotI18nString[]>(`/api/bot-config/${botId}/i18n${params}`);
  }

  async createBotI18nString(botId: string, data: { key: string; locale: string; value: string }): Promise<BotI18nString> {
    return this.request<BotI18nString>(`/api/bot-config/${botId}/i18n`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateBotI18nString(botId: string, stringId: string, data: { value: string }): Promise<BotI18nString> {
    return this.request<BotI18nString>(`/api/bot-config/${botId}/i18n/${stringId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteBotI18nString(botId: string, stringId: string): Promise<void> {
    await this.request<void>(`/api/bot-config/${botId}/i18n/${stringId}`, { method: 'DELETE' });
  }

  async batchUpdateBotI18nStrings(botId: string, items: { key: string; locale: string; value: string }[]): Promise<BotI18nString[]> {
    return this.request<BotI18nString[]>(`/api/bot-config/${botId}/i18n/batch`, { method: 'POST', body: JSON.stringify(items) });
  }

  // TG Client
  async getTgClientSessions(params?: { page?: number; limit?: number }): Promise<TgClientSessionsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    const qs = searchParams.toString();
    return this.request<TgClientSessionsResponse>(`/api/tg-client/sessions${qs ? `?${qs}` : ''}`);
  }

  async getTgClientSession(id: string): Promise<TgClientSession> {
    return this.request<TgClientSession>(`/api/tg-client/sessions/${id}`);
  }

  async updateTgClientSession(id: string, data: { displayName?: string; isActive?: boolean }): Promise<TgClientSession> {
    return this.request<TgClientSession>(`/api/tg-client/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deactivateTgClientSession(id: string): Promise<void> {
    await this.request<void>(`/api/tg-client/sessions/${id}/deactivate`, { method: 'POST' });
  }

  async rotateTgClientSession(id: string): Promise<TgClientSession> {
    return this.request<TgClientSession>(`/api/tg-client/sessions/${id}/rotate`, { method: 'POST' });
  }

  async getTransportHealth(): Promise<TransportHealth> {
    return this.request<TransportHealth>('/api/tg-client/health');
  }

  // Flows
  async getFlows(params?: { page?: number; limit?: number; status?: string }): Promise<FlowsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.request<FlowsResponse>(`/api/flows${qs ? `?${qs}` : ''}`);
  }

  async getFlowTemplates(): Promise<{ id: string; name: string; description: string; category: string; platform: string; nodeCount: number }[]> {
    return this.request(`/api/flows/templates`);
  }

  async createFlowFromTemplate(templateId: string): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/from-template/${templateId}`, { method: 'POST' });
  }

  async getFlow(id: string): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/${id}`);
  }

  async createFlow(data: { name: string; description?: string; platform?: string }): Promise<FlowDefinition> {
    return this.request<FlowDefinition>('/api/flows', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateFlow(id: string, data: { name?: string; description?: string; nodesJson?: any; edgesJson?: any; transportConfig?: { transport: string; botInstanceId?: string; discordBotInstanceId?: string }; platform?: string }): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteFlow(id: string): Promise<void> {
    await this.request<void>(`/api/flows/${id}`, { method: 'DELETE' });
  }

  async validateFlow(id: string): Promise<FlowValidation> {
    return this.request<FlowValidation>(`/api/flows/${id}/validate`, { method: 'POST' });
  }

  async activateFlow(id: string): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/${id}/activate`, { method: 'POST' });
  }

  async deactivateFlow(id: string): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/${id}/deactivate`, { method: 'POST' });
  }

  async getFlowExecutions(flowId: string, params?: { page?: number; limit?: number }): Promise<{ data: FlowExecution[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    const qs = searchParams.toString();
    return this.request<{ data: FlowExecution[]; total: number }>(`/api/flows/${flowId}/executions${qs ? `?${qs}` : ''}`);
  }

  async getFlowVersions(flowId: string): Promise<FlowVersion[]> {
    return this.request<FlowVersion[]>(`/api/flows/${flowId}/versions`);
  }

  async getFlowVersion(flowId: string, versionId: string): Promise<FlowVersion> {
    return this.request<FlowVersion>(`/api/flows/${flowId}/versions/${versionId}`);
  }

  async createFlowVersion(flowId: string, createdBy?: string): Promise<FlowVersion> {
    return this.request<FlowVersion>(`/api/flows/${flowId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ createdBy }),
    });
  }

  async restoreFlowVersion(flowId: string, versionId: string): Promise<FlowDefinition> {
    return this.request<FlowDefinition>(`/api/flows/${flowId}/versions/${versionId}/restore`, {
      method: 'POST',
    });
  }

  async getFlowAnalytics(flowId: string): Promise<FlowAnalytics> {
    return this.request<FlowAnalytics>(`/api/flows/${flowId}/analytics`);
  }

  async testExecuteFlow(flowId: string, triggerData?: any): Promise<FlowExecution> {
    return this.request<FlowExecution>(`/api/flows/${flowId}/test-execute`, {
      method: 'POST',
      body: JSON.stringify({ triggerData }),
    });
  }

  async getFlowExecution(executionId: string): Promise<FlowExecution> {
    return this.request<FlowExecution>(`/api/flows/executions/${executionId}`);
  }

  async getFlowGlobalAnalytics(days?: number): Promise<FlowGlobalAnalytics> {
    const qs = days ? `?days=${days}` : '';
    return this.request<FlowGlobalAnalytics>(`/api/flows/analytics${qs}`);
  }

  async saveFlowDraft(flowId: string, data: { nodesJson: unknown; edgesJson: unknown }): Promise<void> {
    return this.request(`/api/flows/${flowId}/draft`, { method: "PUT", body: JSON.stringify(data) });
  }

  async getFlowDraft(flowId: string): Promise<{ nodesJson: unknown; edgesJson: unknown } | null> {
    return this.request(`/api/flows/${flowId}/draft`);
  }

  async startTgAuth(phoneNumber: string): Promise<{ sessionId: string; status: string }> {
    return this.request<{ sessionId: string; status: string }>('/api/tg-client/auth/start', { method: 'POST', body: JSON.stringify({ phoneNumber }) });
  }

  async submitTgAuthCode(sessionId: string, code: string): Promise<{ sessionId: string; status: string }> {
    return this.request<{ sessionId: string; status: string }>('/api/tg-client/auth/code', { method: 'POST', body: JSON.stringify({ sessionId, code }) });
  }

  async submitTgAuthPassword(sessionId: string, password: string): Promise<{ sessionId: string; status: string }> {
    return this.request<{ sessionId: string; status: string }>('/api/tg-client/auth/password', { method: 'POST', body: JSON.stringify({ sessionId, password }) });
  }

  // Webhooks
  async getWebhooks(): Promise<WebhookEndpoint[]> {
    return this.request<WebhookEndpoint[]>('/api/webhooks');
  }

  async createWebhook(data: { name: string; flowId?: string }): Promise<WebhookEndpoint> {
    return this.request<WebhookEndpoint>('/api/webhooks', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteWebhook(id: string): Promise<void> {
    await this.request<void>(`/api/webhooks/${id}`, { method: 'DELETE' });
  }

  // Platform Accounts
  async getAccounts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    platform?: string;
    isBanned?: boolean;
  }): Promise<{ data: PlatformAccount[]; total: number; page: number; limit: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.isBanned !== undefined) searchParams.set("isBanned", String(params.isBanned));
    return this.request<{ data: PlatformAccount[]; total: number; page: number; limit: number; totalPages: number }>(`/api/accounts?${searchParams}`);
  }

  async getAccountStats(): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    bannedAccounts: number;
    newAccountsToday: number;
    verifiedAccounts: number;
    totalMessages: number;
    totalCommands: number;
    platformBreakdown: Record<string, number>;
  }> {
    return this.request<{
      totalAccounts: number;
      activeAccounts: number;
      bannedAccounts: number;
      newAccountsToday: number;
      verifiedAccounts: number;
      totalMessages: number;
      totalCommands: number;
      platformBreakdown: Record<string, number>;
    }>("/api/accounts/stats");
  }

  async banAccount(id: string, isBanned: boolean, banReason?: string): Promise<PlatformAccount> {
    return this.request<PlatformAccount>(`/api/accounts/${id}/ban`, {
      method: "PUT",
      body: JSON.stringify({ isBanned, banReason }),
    });
  }

  // Identities
  async getIdentities(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: UserIdentity[]; total: number; page: number; limit: number; totalPages: number }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    return this.request<{ data: UserIdentity[]; total: number; page: number; limit: number; totalPages: number }>(`/api/identities?${searchParams}`);
  }

  async linkAccount(identityId: string, platformAccountId: string): Promise<UserIdentity> {
    return this.request<UserIdentity>(`/api/identities/${identityId}/link`, {
      method: "POST",
      body: JSON.stringify({ platformAccountId }),
    });
  }

  async unlinkAccount(identityId: string, accountId: string): Promise<UserIdentity> {
    return this.request<UserIdentity>(`/api/identities/${identityId}/link/${accountId}`, {
      method: "DELETE",
    });
  }


  async updateBotScope(botInstanceId: string, scope: { groupIds?: string[]; userIds?: string[] }): Promise<unknown> {
    return this.request<unknown>(`/api/bot-config/${botInstanceId}/scope`, {
      method: 'PUT',
      body: JSON.stringify(scope),
    });
  }

  // Connections
  async getConnections(params?: {
    page?: number;
    limit?: number;
    platform?: string;
    status?: string;
  }): Promise<ConnectionsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.platform) searchParams.set("platform", params.platform);
    if (params?.status) searchParams.set("status", params.status);
    return this.request<ConnectionsResponse>(`/api/connections?${searchParams}`);
  }

  async getConnectionHealth(): Promise<ConnectionHealth> {
    return this.request<ConnectionHealth>('/api/connections/health');
  }

  async getConnection(id: string): Promise<PlatformConnectionType> {
    return this.request<PlatformConnectionType>(`/api/connections/${id}`);
  }

  async createConnection(data: {
    platform: string;
    name: string;
    connectionType: string;
    metadata?: Record<string, unknown>;
    botInstanceId?: string;
  }): Promise<PlatformConnectionType> {
    return this.request<PlatformConnectionType>('/api/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startConnectionAuth(id: string, params: Record<string, unknown>): Promise<{ connectionId: string; status: string; sessionId?: string }> {
    return this.request<{ connectionId: string; status: string; sessionId?: string }>(`/api/connections/${id}/auth/start`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    });
  }

  async submitConnectionAuthStep(id: string, step: string, data: Record<string, unknown>): Promise<{ connectionId: string; status: string }> {
    return this.request<{ connectionId: string; status: string }>(`/api/connections/${id}/auth/${step}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getConnectionLogs(id: string, params?: { page?: number; limit?: number }): Promise<ConnectionLogsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return this.request<ConnectionLogsResponse>(`/api/connections/${id}/logs?${searchParams}`);
  }

  async deactivateConnection(id: string): Promise<PlatformConnectionType> {
    return this.request<PlatformConnectionType>(`/api/connections/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async getAvailableGroups(connectionId: string): Promise<{ groups: Array<{ id: string; name: string; memberCount: number }> }> {
    return this.request<{ groups: Array<{ id: string; name: string; memberCount: number }> }>(`/api/connections/${connectionId}/available-groups`);
  }
}

export const api = new ApiClient();

// Standalone API functions (aliases for api client methods)
export async function getAccounts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  platform?: string;
  isBanned?: boolean;
}): Promise<{ data: PlatformAccount[]; total: number; page: number; limit: number; totalPages: number }> {
  return api.getAccounts(params);
}

export async function getAccountStats(): Promise<{
  totalAccounts: number;
  activeAccounts: number;
  bannedAccounts: number;
  newAccountsToday: number;
  verifiedAccounts: number;
  totalMessages: number;
  totalCommands: number;
  platformBreakdown: Record<string, number>;
}> {
  return api.getAccountStats();
}

export async function banAccount(id: string, isBanned: boolean, banReason?: string): Promise<PlatformAccount> {
  return api.banAccount(id, isBanned, banReason);
}

export async function getIdentities(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ data: UserIdentity[]; total: number; page: number; limit: number; totalPages: number }> {
  return api.getIdentities(params);
}

export async function linkAccount(identityId: string, platformAccountId: string): Promise<UserIdentity> {
  return api.linkAccount(identityId, platformAccountId);
}

export async function unlinkAccount(identityId: string, accountId: string): Promise<UserIdentity> {
  return api.unlinkAccount(identityId, accountId);
}


export async function getConnections(params?: {
  page?: number;
  limit?: number;
  platform?: string;
  status?: string;
}): Promise<ConnectionsResponse> {
  return api.getConnections(params);
}

export async function getConnectionHealth(): Promise<ConnectionHealth> {
  return api.getConnectionHealth();
}

export async function getConnection(id: string): Promise<PlatformConnectionType> {
  return api.getConnection(id);
}

export async function createConnection(data: {
  platform: string;
  name: string;
  connectionType: string;
  metadata?: Record<string, unknown>;
  botInstanceId?: string;
}): Promise<PlatformConnectionType> {
  return api.createConnection(data);
}

export async function getConnectionLogs(id: string, params?: {
  page?: number;
  limit?: number;
}): Promise<ConnectionLogsResponse> {
  return api.getConnectionLogs(id, params);
}

export async function deactivateConnection(id: string): Promise<PlatformConnectionType> {
  return api.deactivateConnection(id);
}

export async function getAvailableGroups(connectionId: string): Promise<{ groups: Array<{ id: string; name: string; memberCount: number }> }> {
  return api.getAvailableGroups(connectionId);
}

