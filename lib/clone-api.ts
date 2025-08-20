/**
 * Clone API Client - Manages AI clone creation and management
 */
import { apiClient, parseApiError } from './api-client';

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
  published_at?: string;
  avatar_url?: string;
  voice_id?: string;
  average_rating: number;
  total_sessions: number;
  total_earnings: number;
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
  async createClone(data: CloneCreateRequest): Promise<CloneResponse> {
    try {
      const response = await apiClient.post('/clones', data);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async updateClone(id: string, data: Partial<CloneCreateRequest>): Promise<CloneResponse> {
    try {
      const response = await apiClient.put(`/clones/${id}`, data);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async getClone(id: string): Promise<CloneResponse> {
    try {
      const response = await apiClient.get(`/clones/${id}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message || 'Failed to retrieve clone');
    }
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
    try {
      const response = await apiClient.get('/clones', { params });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async deleteClone(id: string): Promise<void> {
    try {
      await apiClient.delete(`/clones/${id}`);
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async publishClone(id: string): Promise<CloneResponse> {
    try {
      const response = await apiClient.post(`/clones/${id}/publish`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async unpublishClone(id: string): Promise<CloneResponse> {
    try {
      const response = await apiClient.post(`/clones/${id}/unpublish`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
  }

  async getUserClones(params?: {
    page?: number;
    limit?: number;
    published_only?: boolean;
  }): Promise<CloneListResponse> {
    try {
      const response = await apiClient.get('/clones/my-clones', { params });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as any);
      throw new Error(apiError.message);
    }
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