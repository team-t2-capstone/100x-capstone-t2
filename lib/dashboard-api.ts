/**
 * Dashboard API Client - Handles dashboard-specific API calls
 * Includes analytics, user data, clone management, and sessions
 */
import { apiClient, parseApiError } from './api-client';
import { AxiosError } from 'axios';

// Dashboard Data Types
export interface UserStats {
  totalSessions: number;
  totalSpent: number;
  favoriteClones: Array<{
    id: string;
    name: string;
    category: string;
    sessions: number;
  }>;
  recentSessions: Array<{
    id: string;
    cloneName: string;
    date: string;
    duration: number;
    cost: number;
    rating?: number;
  }>;
}

export interface CreatorStats {
  totalEarnings: number;
  totalSessions: number;
  averageRating: number;
  activeClones: number;
  growthRate: number;
  monthlyTrends: {
    earnings: number[];
    sessions: number[];
    ratings: number[];
  };
}

export interface CloneData {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'draft' | 'paused';
  avatar?: string;
  sessions: number;
  rating: number;
  earnings: number;
  lastSession: string;
  createdAt: string;
  pricing: {
    text: number;
    voice: number;
    video: number;
  };
}

export interface SessionData {
  id: string;
  cloneName: string;
  userName: string;
  userAvatar?: string;
  sessionType: 'Text Chat' | 'Voice Call' | 'Video Call';
  duration: string;
  earnings: number;
  rating: number;
  date: string;
  feedback?: string;
}

export interface UserAnalytics {
  user_id: string;
  total_sessions: number;
  total_duration_minutes: number;
  total_messages_sent: number;
  total_spent: number;
  average_session_duration: number;
  favorite_categories: string[];
  most_used_clones: Array<{
    clone_id: string;
    clone_name: string;
    sessions: number;
  }>;
  engagement_score: number;
  last_active?: string;
  activity_streak_days: number;
  weekly_activity: Array<{
    week: string;
    sessions: number;
    duration_minutes: number;
    spent: number;
  }>;
  monthly_trends: {
    sessions: number[];
    duration: number[];
    spent: number[];
  };
}

export interface CreatorAnalytics {
  total_earnings: number;
  total_sessions: number;
  average_rating: number;
  user_retention_rate: number;
  popular_topics: string[];
  monthly_trends: {
    earnings: number[];
    sessions: number[];
    ratings: number[];
  };
}

export interface ClonePerformance {
  clone_id: string;
  clone_name: string;
  total_sessions: number;
  total_earnings: number;
  average_rating: number;
  total_ratings: number;
  total_duration_minutes: number;
  unique_users: number;
  user_retention_rate: number;
  popular_topics: string[];
  performance_score: number;
  earnings_trend: Array<{
    week: string;
    earnings: number;
    sessions: number;
  }>;
  usage_patterns: {
    peak_hour: number;
    peak_day: string;
    hourly_distribution: Record<string, number>;
    daily_distribution: Record<string, number>;
  };
  feedback_analysis: {
    positive_feedback_rate: number;
    negative_feedback_rate: number;
    satisfaction_trend: string;
  };
}

export class DashboardApi {
  
  // User Dashboard Methods
  async getUserAnalytics(userId: string, days: number = 30): Promise<UserAnalytics> {
    try {
      const response = await apiClient.get(`/analytics/users/${userId}?days=${days}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch user analytics: ${apiError.message}`);
    }
  }

  async getUserSessions(userId: string, page: number = 1, limit: number = 10) {
    try {
      const response = await apiClient.get(`/sessions/user/${userId}?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch user sessions: ${apiError.message}`);
    }
  }

  async getUserFavorites(userId: string) {
    try {
      const response = await apiClient.get(`/users/${userId}/favorites`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch user favorites: ${apiError.message}`);
    }
  }

  // Creator Dashboard Methods
  async getCreatorAnalytics(creatorId: string, days: number = 30): Promise<CreatorAnalytics> {
    try {
      const response = await apiClient.get(`/analytics/creators/${creatorId}?days=${days}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch creator analytics: ${apiError.message}`);
    }
  }

  async getCreatorClones(creatorId: string, page: number = 1, limit: number = 10) {
    try {
      const response = await apiClient.get(`/clones/my-clones?creator_id=${creatorId}&page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch creator clones: ${apiError.message}`);
    }
  }

  async getCreatorSessions(creatorId: string, page: number = 1, limit: number = 10) {
    try {
      const response = await apiClient.get(`/sessions/creator/${creatorId}?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch creator sessions: ${apiError.message}`);
    }
  }

  // Clone Management Methods
  async getClonePerformance(cloneId: string, days: number = 30): Promise<ClonePerformance> {
    try {
      const response = await apiClient.get(`/analytics/clones/${cloneId}?days=${days}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch clone performance: ${apiError.message}`);
    }
  }

  async updateCloneStatus(cloneId: string, status: 'active' | 'paused' | 'draft') {
    try {
      const response = await apiClient.patch(`/clones/${cloneId}/status`, { status });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to update clone status: ${apiError.message}`);
    }
  }

  async deleteClone(cloneId: string) {
    try {
      await apiClient.delete(`/clones/${cloneId}`);
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to delete clone: ${apiError.message}`);
    }
  }

  // Profile Management Methods
  async getUserProfile(userId: string) {
    try {
      const response = await apiClient.get(`/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch user profile: ${apiError.message}`);
    }
  }

  async updateUserProfile(userId: string, profileData: any) {
    try {
      const response = await apiClient.put(`/users/${userId}/profile`, profileData);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to update user profile: ${apiError.message}`);
    }
  }

  async updateUserPreferences(userId: string, preferences: any) {
    try {
      const response = await apiClient.put(`/users/${userId}/preferences`, preferences);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to update user preferences: ${apiError.message}`);
    }
  }

  // Billing Methods
  async getBillingInfo(userId: string) {
    try {
      const response = await apiClient.get(`/billing/${userId}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch billing info: ${apiError.message}`);
    }
  }

  async getBillingHistory(userId: string, page: number = 1, limit: number = 10) {
    try {
      const response = await apiClient.get(`/billing/${userId}/history?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to fetch billing history: ${apiError.message}`);
    }
  }

  async updatePaymentMethod(userId: string, paymentMethodData: any) {
    try {
      const response = await apiClient.put(`/billing/${userId}/payment-method`, paymentMethodData);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to update payment method: ${apiError.message}`);
    }
  }

  // Discovery Methods
  async discoverClones(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    price_min?: number;
    price_max?: number;
    sort_by?: string;
  }) {
    try {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await apiClient.get(`/discovery/clones?${searchParams}`);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to discover clones: ${apiError.message}`);
    }
  }

  async addToFavorites(userId: string, cloneId: string) {
    try {
      const response = await apiClient.post(`/users/${userId}/favorites`, { clone_id: cloneId });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to add to favorites: ${apiError.message}`);
    }
  }

  async removeFromFavorites(userId: string, cloneId: string) {
    try {
      await apiClient.delete(`/users/${userId}/favorites/${cloneId}`);
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to remove from favorites: ${apiError.message}`);
    }
  }
}

// Export singleton instance
export const dashboardApi = new DashboardApi();

// Convenience functions
export const getUserAnalytics = (userId: string, days?: number) => 
  dashboardApi.getUserAnalytics(userId, days);

export const getCreatorAnalytics = (creatorId: string, days?: number) => 
  dashboardApi.getCreatorAnalytics(creatorId, days);

export const getClonePerformance = (cloneId: string, days?: number) => 
  dashboardApi.getClonePerformance(cloneId, days);

export const getUserProfile = (userId: string) => 
  dashboardApi.getUserProfile(userId);

export const updateUserProfile = (userId: string, profileData: any) => 
  dashboardApi.updateUserProfile(userId, profileData);

export const getBillingInfo = (userId: string) => 
  dashboardApi.getBillingInfo(userId);

export const discoverClones = (params?: Parameters<typeof dashboardApi.discoverClones>[0]) => 
  dashboardApi.discoverClones(params);