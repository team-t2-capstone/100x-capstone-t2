/**
 * Dashboard Data Hooks
 * Custom hooks for managing dashboard data with caching and real-time updates
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  dashboardApi, 
  UserAnalytics, 
  CreatorAnalytics, 
  ClonePerformance,
  type CloneData,
  type SessionData
} from '@/lib/dashboard-api';

// Hook for user dashboard data
export function useUserDashboard(userId: string, days: number = 30) {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, sessionsData, favoritesData] = await Promise.allSettled([
        dashboardApi.getUserAnalytics(userId, days),
        dashboardApi.getUserSessions(userId, 1, 5),
        dashboardApi.getUserFavorites(userId)
      ]);

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }
      
      if (sessionsData.status === 'fulfilled') {
        setSessions(sessionsData.value?.sessions || []);
      }
      
      if (favoritesData.status === 'fulfilled') {
        setFavorites(favoritesData.value?.favorites || []);
      }
      
      // If any critical data failed, show error
      if (analyticsData.status === 'rejected') {
        setError(analyticsData.reason.message);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [userId, days]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const stats = useMemo(() => {
    if (!analytics) return null;
    
    return {
      totalSessions: analytics.total_sessions,
      totalSpent: analytics.total_spent,
      avgSessionDuration: analytics.average_session_duration,
      engagementScore: analytics.engagement_score,
      activityStreak: analytics.activity_streak_days,
      favoriteCategories: analytics.favorite_categories,
      mostUsedClones: analytics.most_used_clones,
      weeklyActivity: analytics.weekly_activity,
      monthlyTrends: analytics.monthly_trends
    };
  }, [analytics]);

  return {
    analytics,
    sessions,
    favorites,
    stats,
    loading,
    error,
    refresh: fetchUserData
  };
}

// Hook for creator dashboard data
export function useCreatorDashboard(creatorId: string, days: number = 30) {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [clones, setClones] = useState<CloneData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreatorData = useCallback(async () => {
    if (!creatorId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, clonesData, sessionsData] = await Promise.allSettled([
        dashboardApi.getCreatorAnalytics(creatorId, days),
        dashboardApi.getCreatorClones(creatorId, 1, 10),
        dashboardApi.getCreatorSessions(creatorId, 1, 5)
      ]);

      if (analyticsData.status === 'fulfilled') {
        setAnalytics(analyticsData.value);
      }
      
      if (clonesData.status === 'fulfilled') {
        setClones(clonesData.value?.clones || []);
      }
      
      if (sessionsData.status === 'fulfilled') {
        setSessions(sessionsData.value?.sessions || []);
      }
      
      // If any critical data failed, show error
      if (analyticsData.status === 'rejected') {
        setError(analyticsData.reason.message);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load creator dashboard data');
    } finally {
      setLoading(false);
    }
  }, [creatorId, days]);

  useEffect(() => {
    fetchCreatorData();
  }, [fetchCreatorData]);

  const stats = useMemo(() => {
    if (!analytics) return null;
    
    return {
      totalEarnings: analytics.total_earnings,
      totalSessions: analytics.total_sessions,
      averageRating: analytics.average_rating,
      retentionRate: analytics.user_retention_rate,
      popularTopics: analytics.popular_topics,
      monthlyTrends: analytics.monthly_trends,
      activeClones: clones.filter(c => c.status === 'active').length,
      growthRate: analytics.monthly_trends.earnings.length > 1 
        ? ((analytics.monthly_trends.earnings[analytics.monthly_trends.earnings.length - 1] - 
            analytics.monthly_trends.earnings[analytics.monthly_trends.earnings.length - 2]) / 
           (analytics.monthly_trends.earnings[analytics.monthly_trends.earnings.length - 2] || 1)) * 100
        : 0
    };
  }, [analytics, clones]);

  return {
    analytics,
    clones,
    sessions,
    stats,
    loading,
    error,
    refresh: fetchCreatorData
  };
}

// Hook for clone performance data
export function useClonePerformance(cloneId: string, days: number = 30) {
  const [performance, setPerformance] = useState<ClonePerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCloneData = useCallback(async () => {
    if (!cloneId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await dashboardApi.getClonePerformance(cloneId, days);
      setPerformance(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clone performance data');
    } finally {
      setLoading(false);
    }
  }, [cloneId, days]);

  useEffect(() => {
    fetchCloneData();
  }, [fetchCloneData]);

  return {
    performance,
    loading,
    error,
    refresh: fetchCloneData
  };
}

// Hook for clone management operations
export function useCloneManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCloneStatus = useCallback(async (cloneId: string, status: 'active' | 'paused' | 'draft') => {
    try {
      setLoading(true);
      setError(null);
      
      await dashboardApi.updateCloneStatus(cloneId, status);
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update clone status');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteClone = useCallback(async (cloneId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await dashboardApi.deleteClone(cloneId);
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete clone');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateCloneStatus,
    deleteClone,
    loading,
    error
  };
}

// Hook for user profile management
export function useUserProfile(userId: string) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await dashboardApi.getUserProfile(userId);
      setProfile(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateProfile = useCallback(async (profileData: any) => {
    try {
      setUpdating(true);
      setError(null);
      
      const updatedProfile = await dashboardApi.updateUserProfile(userId, profileData);
      setProfile(updatedProfile);
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [userId]);

  const updatePreferences = useCallback(async (preferences: any) => {
    try {
      setUpdating(true);
      setError(null);
      
      await dashboardApi.updateUserPreferences(userId, preferences);
      // Refetch profile to get updated preferences
      await fetchProfile();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [userId, fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    updating,
    updateProfile,
    updatePreferences,
    refresh: fetchProfile
  };
}

// Hook for billing information
export function useBilling(userId: string) {
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingData = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [infoData, historyData] = await Promise.allSettled([
        dashboardApi.getBillingInfo(userId),
        dashboardApi.getBillingHistory(userId, 1, 10)
      ]);

      if (infoData.status === 'fulfilled') {
        setBillingInfo(infoData.value);
      }
      
      if (historyData.status === 'fulfilled') {
        setBillingHistory(historyData.value?.transactions || []);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updatePaymentMethod = useCallback(async (paymentMethodData: any) => {
    try {
      setLoading(true);
      setError(null);
      
      await dashboardApi.updatePaymentMethod(userId, paymentMethodData);
      await fetchBillingData(); // Refresh data
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment method');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, fetchBillingData]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  return {
    billingInfo,
    billingHistory,
    loading,
    error,
    updatePaymentMethod,
    refresh: fetchBillingData
  };
}

// Hook for favorites management
export function useFavorites(userId: string) {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await dashboardApi.getUserFavorites(userId);
      setFavorites(data.favorites || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addToFavorites = useCallback(async (cloneId: string) => {
    try {
      setError(null);
      
      await dashboardApi.addToFavorites(userId, cloneId);
      await fetchFavorites(); // Refresh list
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to favorites');
      return false;
    }
  }, [userId, fetchFavorites]);

  const removeFromFavorites = useCallback(async (cloneId: string) => {
    try {
      setError(null);
      
      await dashboardApi.removeFromFavorites(userId, cloneId);
      setFavorites(prev => prev.filter(fav => fav.id !== cloneId));
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove from favorites');
      return false;
    }
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites,
    loading,
    error,
    addToFavorites,
    removeFromFavorites,
    refresh: fetchFavorites
  };
}