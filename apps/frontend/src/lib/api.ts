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
}

export const api = new ApiClient();
