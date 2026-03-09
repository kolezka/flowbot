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

// Product interfaces
export interface Product {
  id: string;
  name: string;
  description?: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  categoryId: string;
  category?: Category;
  images: string[];
  thumbnail?: string;
  sku?: string;
  stock: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  categoryId: string;
  images: string[];
  thumbnail?: string;
  sku?: string;
  stock: number;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface Category {
  id: string;
  name: string;
  description?: string;
  slug: string;
  imageUrl?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  children: CategoryTreeNode[];
}

export interface CategoriesResponse {
  data: Category[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  product?: Product;
  quantity: number;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  user?: User;
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartsResponse {
  data: Cart[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Broadcast interfaces
export interface Broadcast {
  id: string;
  status: string;
  text: string;
  targetChatIds: string[];
  results?: any;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastsResponse {
  data: Broadcast[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateBroadcastDto {
  text: string;
  targetChatIds: string[];
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
  maxWarnings: number;
  warningExpiry: number;
  muteOnWarn: boolean;
  muteDuration: number;
  antiSpam: boolean;
  antiFlood: boolean;
  floodLimit: number;
  floodWindow: number;
  welcomeEnabled: boolean;
  welcomeMessage?: string;
  logChannelId?: string;
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

export interface ApiError {
  message: string;
  status?: number;
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

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

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

  // Products
  async getProducts(
    page?: number,
    limit?: number,
    search?: string,
    categoryId?: string,
    isActive?: boolean,
    inStock?: boolean
  ): Promise<ProductsResponse> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    if (isActive !== undefined) params.append('isActive', isActive.toString());
    if (inStock !== undefined) params.append('inStock', inStock.toString());

    const queryString = params.toString();
    return this.request<ProductsResponse>(`/api/products${queryString ? `?${queryString}` : ''}`);
  }

  async getProduct(id: string): Promise<Product> {
    return this.request<Product>(`/api/products/${id}`);
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    return this.request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return this.request<Product>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.request<void>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategoryTree(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories/tree');
  }

  // Get all active categories (no pagination) - for dropdowns
  async getAllCategories(): Promise<Category[]> {
    const response = await this.request<CategoriesResponse>('/api/categories');
    return response.data;
  }

  async getCategories(page?: number, limit?: number): Promise<CategoriesResponse> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());

    const queryString = params.toString();
    return this.request<CategoriesResponse>(`/api/categories${queryString ? `?${queryString}` : ''}`);
  }

  async getCategory(id: string): Promise<Category> {
    return this.request<Category>(`/api/categories/${id}`);
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    return this.request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    return this.request<Category>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.request<void>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Carts
  async getCart(userId: string): Promise<Cart> {
    return this.request<Cart>(`/api/cart/user/${userId}`);
  }

  async getAllCarts(page?: number, limit?: number): Promise<CartsResponse> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());

    const queryString = params.toString();
    return this.request<CartsResponse>(`/api/cart${queryString ? `?${queryString}` : ''}`);
  }

  async clearCart(userId: string): Promise<void> {
    return this.request<void>(`/api/cart/user/${userId}/clear`, {
      method: 'DELETE',
    });
  }

  async addCartItem(userId: string, data: { productId: string; quantity: number }): Promise<CartItem> {
    return this.request<CartItem>(`/api/cart/user/${userId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCartItem(userId: string, itemId: string, data: { quantity: number }): Promise<CartItem> {
    return this.request<CartItem>(`/api/cart/user/${userId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeCartItem(userId: string, itemId: string): Promise<void> {
    return this.request<void>(`/api/cart/user/${userId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Broadcasts
  async getBroadcasts(page?: number, limit?: number): Promise<BroadcastsResponse> {
    const params = new URLSearchParams();
    if (page !== undefined) params.append('page', page.toString());
    if (limit !== undefined) params.append('limit', limit.toString());

    const queryString = params.toString();
    return this.request<BroadcastsResponse>(`/api/broadcast${queryString ? `?${queryString}` : ''}`);
  }

  async getBroadcast(id: string): Promise<Broadcast> {
    return this.request<Broadcast>(`/api/broadcast/${id}`);
  }

  async createBroadcast(data: CreateBroadcastDto): Promise<Broadcast> {
    return this.request<Broadcast>('/api/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
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
    return this.request<GroupsResponse>(`/api/moderation/groups${qs ? `?${qs}` : ''}`);
  }

  async getGroup(id: string): Promise<ManagedGroup> {
    return this.request<ManagedGroup>(`/api/moderation/groups/${id}`);
  }

  async updateGroupConfig(id: string, data: Partial<GroupConfig>): Promise<ManagedGroup> {
    return this.request<ManagedGroup>(`/api/moderation/groups/${id}/config`, {
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
    return this.request<WarningsResponse>(`/api/moderation/warnings${qs ? `?${qs}` : ''}`);
  }

  async deactivateWarning(id: string): Promise<Warning> {
    return this.request<Warning>(`/api/moderation/warnings/${id}/deactivate`, {
      method: 'PATCH',
    });
  }

  async getWarningStats(): Promise<WarningStats> {
    return this.request<WarningStats>('/api/moderation/warnings/stats');
  }

  // Moderation - Group Members
  async getGroupMembers(groupId: string, params?: {
    page?: number; limit?: number; search?: string; role?: string;
  }): Promise<GroupMembersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) searchParams.append('page', params.page.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.role) searchParams.append('role', params.role);
    const qs = searchParams.toString();
    return this.request<GroupMembersResponse>(`/api/moderation/groups/${groupId}/members${qs ? `?${qs}` : ''}`);
  }

  async getGroupMember(groupId: string, memberId: string): Promise<GroupMember> {
    return this.request<GroupMember>(`/api/moderation/groups/${groupId}/members/${memberId}`);
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
}

export const api = new ApiClient();
