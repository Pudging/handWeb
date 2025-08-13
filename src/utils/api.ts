const API_BASE = 'http://localhost:5000/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

class ApiClient {
  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          // Token expired or invalid, remove it
          localStorage.removeItem('jwt_token');
          window.location.reload(); // Redirect to login
        }
        
        return {
          success: false,
          message: data.message || `HTTP ${response.status}`,
          errors: data.errors
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message
      };
    } catch (error) {
      return {
        success: false,
        message: 'Network error or invalid response'
      };
    }
  }

  // Generic request method
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    includeAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(includeAuth),
        ...options
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        message: 'Network error'
      };
    }
  }

  // GET request
  async get<T>(endpoint: string, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, includeAuth);
  }

  // POST request
  async post<T>(endpoint: string, data: any, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    }, includeAuth);
  }

  // PUT request
  async put<T>(endpoint: string, data: any, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    }, includeAuth);
  }

  // DELETE request
  async delete<T>(endpoint: string, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, includeAuth);
  }

  // PATCH request
  async patch<T>(endpoint: string, data: any, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }, includeAuth);
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem('jwt_token');
    return !!token;
  }

  // Get current token
  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  // Clear token (logout)
  clearToken(): void {
    localStorage.removeItem('jwt_token');
  }

  // Refresh token
  async refreshToken(): Promise<boolean> {
    try {
      const response = await this.post('/auth/refresh', {});
      if (response.success && response.data?.token) {
        localStorage.setItem('jwt_token', response.data.token);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export specific API methods for common operations
export const auth = {
  login: (identifier: string, password: string) => 
    apiClient.post('/auth/login', { identifier, password }, false),
  
  register: (username: string, email: string, password: string) => 
    apiClient.post('/auth/register', { username, email, password }, false),
  
  logout: () => apiClient.post('/auth/logout', {}),
  
  getProfile: () => apiClient.get('/auth/me'),
  
  updateProfile: (profileData: any) => 
    apiClient.put('/auth/profile', profileData),
  
  changePassword: (currentPassword: string, newPassword: string) => 
    apiClient.put('/auth/change-password', { currentPassword, newPassword }),
  
  forgotPassword: (email: string) => 
    apiClient.post('/auth/forgot-password', { email }, false),
  
  resetPassword: (token: string, newPassword: string) => 
    apiClient.post('/auth/reset-password', { token, newPassword }, false)
};

export const decks = {
  getAll: () => apiClient.get('/decks'),
  getById: (id: string) => apiClient.get(`/decks/${id}`),
  create: (deckData: any) => apiClient.post('/decks', deckData),
  update: (id: string, deckData: any) => apiClient.put(`/decks/${id}`, deckData),
  delete: (id: string) => apiClient.delete(`/decks/${id}`),
  getPublic: () => apiClient.get('/decks/public', false),
  getPopular: () => apiClient.get('/decks/popular', false),
  getByArchetype: (archetype: string) => apiClient.get(`/decks/archetype/${archetype}`, false),
  favorite: (id: string) => apiClient.post(`/decks/${id}/favorite`, {}),
  share: (id: string) => apiClient.post(`/decks/${id}/share`, {}),
  duplicate: (id: string) => apiClient.post(`/decks/${id}/duplicate`, {}),
  getAnalytics: (id: string) => apiClient.get(`/decks/${id}/analytics`)
};

export const cards = {
  search: (query: string, filters?: any) => 
    apiClient.get(`/cards/search?q=${encodeURIComponent(query)}&${new URLSearchParams(filters)}`, false),
  
  getById: (id: string) => apiClient.get(`/cards/${id}`, false),
  getPopular: (limit?: number) => apiClient.get(`/cards/popular${limit ? `?limit=${limit}` : ''}`, false),
  getByArchetype: (archetype: string) => apiClient.get(`/cards/archetype/${archetype}`, false),
  getStaple: () => apiClient.get('/cards/staple', false),
  getBulk: (ids: string[]) => apiClient.post('/cards/bulk', { ids }, false),
  sync: () => apiClient.post('/cards/sync', {}),
  updateRating: (id: string, aiScore: number, metaTier: string) => 
    apiClient.put(`/cards/${id}/rating`, { aiScore, metaTier }),
  addSynergy: (id: string, cardId: string, strength: number, reason: string) => 
    apiClient.post(`/cards/${id}/synergy`, { cardId, strength, reason }),
  getFilters: () => ({
    attributes: () => apiClient.get('/cards/filters/attributes', false),
    types: () => apiClient.get('/cards/filters/types', false),
    races: () => apiClient.get('/cards/filters/races', false),
    archetypes: () => apiClient.get('/cards/filters/archetypes', false)
  })
};

export const analytics = {
  getDashboard: () => apiClient.get('/analytics/dashboard'),
  getDeckAnalytics: (deckId: string) => apiClient.get(`/analytics/deck/${deckId}`),
  getGlobal: () => apiClient.get('/analytics/global', false),
  getTrends: () => apiClient.get('/analytics/trends', false),
  compare: (deckIds: string[]) => apiClient.get(`/analytics/compare?decks=${deckIds.join(',')}`),
  saveSimulation: (simulationData: any) => apiClient.post('/analytics/simulation', simulationData)
};

export default apiClient;
