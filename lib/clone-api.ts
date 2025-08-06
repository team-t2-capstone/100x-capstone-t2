/**
 * Clone API Client - Manages AI clone creation and management
 */
import { getAuthTokens } from './api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface CloneCreateRequest {
  name: string;
  description: string;
  category: string;
  expertise_areas: string[];
  base_price: number;
  bio?: string;
  personality_traits?: Record<string, any>;
  communication_style?: Record<string, any>;
  languages: string[];
}

export interface CloneResponse {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  category: string;
  expertise_areas: string[];
  base_price: number;
  bio?: string;
  personality_traits?: Record<string, any>;
  communication_style?: Record<string, any>;
  languages: string[];
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  rating: number;
  total_sessions: number;
}

export interface CloneListResponse {
  clones: CloneResponse[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export class CloneApi {
  private getHeaders() {
    const { accessToken } = getAuthTokens();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  async createClone(data: CloneCreateRequest): Promise<CloneResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to create clone: ${response.status}`);
    }

    return response.json();
  }

  async updateClone(id: string, data: Partial<CloneCreateRequest>): Promise<CloneResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to update clone: ${response.status}`);
    }

    return response.json();
  }

  async getClone(id: string): Promise<CloneResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch clone: ${response.status}`);
    }

    return response.json();
  }

  async listClones(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    price_min?: number;
    price_max?: number;
    creator_id?: string;
  }): Promise<CloneListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/clones?${searchParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to list clones: ${response.status}`);
    }

    return response.json();
  }

  async deleteClone(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to delete clone: ${response.status}`);
    }
  }

  async publishClone(id: string): Promise<CloneResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${id}/publish`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to publish clone: ${response.status}`);
    }

    return response.json();
  }

  async unpublishClone(id: string): Promise<CloneResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/clones/${id}/unpublish`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to unpublish clone: ${response.status}`);
    }

    return response.json();
  }

  async getUserClones(params?: {
    page?: number;
    limit?: number;
    published_only?: boolean;
  }): Promise<CloneListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/clones/my-clones?${searchParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch user clones: ${response.status}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const cloneApi = new CloneApi();

// Convenience functions
export const createClone = (data: CloneCreateRequest) => cloneApi.createClone(data);
export const updateClone = (id: string, data: Partial<CloneCreateRequest>) => cloneApi.updateClone(id, data);
export const getClone = (id: string) => cloneApi.getClone(id);
export const listClones = (params?: Parameters<typeof cloneApi.listClones>[0]) => cloneApi.listClones(params);
export const deleteClone = (id: string) => cloneApi.deleteClone(id);
export const publishClone = (id: string) => cloneApi.publishClone(id);
export const unpublishClone = (id: string) => cloneApi.unpublishClone(id);
export const getUserClones = (params?: Parameters<typeof cloneApi.getUserClones>[0]) => cloneApi.getUserClones(params);