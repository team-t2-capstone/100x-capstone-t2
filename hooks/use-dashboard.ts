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
      
      // Get user analytics from Supabase
      const { supabase } = await import('@/lib/supabase');
      
      const [userProfileData, sessionsData, clonesData] = await Promise.allSettled([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
        supabase.from('clones').select('*').eq('creator_id', userId).limit(5)
      ]);

      // Process user profile data for analytics
      if (userProfileData.status === 'fulfilled' && userProfileData.value.data) {
        const profile = userProfileData.value.data;
        const mockAnalytics: UserAnalytics = {
          user_id: userId,
          total_sessions: 0,
          total_duration_minutes: 0,
          total_messages_sent: 0,
          total_spent: profile.total_spent || 0,
          average_session_duration: 0,
          favorite_categories: [],
          most_used_clones: [],
          engagement_score: 0,
          activity_streak_days: 0,
          weekly_activity: [],
          monthly_trends: { sessions: [], duration: [], spent: [] }
        };
        setAnalytics(mockAnalytics);
      }
      
      if (sessionsData.status === 'fulfilled' && sessionsData.value.data) {
        setSessions(sessionsData.value.data);
      }
      
      if (clonesData.status === 'fulfilled' && clonesData.value.data) {
        setFavorites(clonesData.value.data);
      }
      
      // If any critical data failed, show error
      if (userProfileData.status === 'rejected') {
        setError(userProfileData.reason.message);
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
      
      // Get creator data from Supabase
      const { supabase } = await import('@/lib/supabase');
      
      const [creatorData, clonesData, sessionsData] = await Promise.allSettled([
        supabase.from('user_profiles').select('*').eq('id', creatorId).single(),
        supabase.from('clones').select('*').eq('creator_id', creatorId).limit(10),
        supabase.from('sessions').select('*, clones!sessions_clone_id_fkey(name)').eq('user_id', creatorId).order('created_at', { ascending: false }).limit(5)
      ]);

      // Process creator data for analytics
      if (creatorData.status === 'fulfilled' && creatorData.value.data) {
        const profile = creatorData.value.data;
        const mockAnalytics: CreatorAnalytics = {
          total_earnings: profile.total_spent || 0,
          total_sessions: 0,
          average_rating: 0,
          user_retention_rate: 0,
          popular_topics: [],
          monthly_trends: { earnings: [], sessions: [], ratings: [] }
        };
        setAnalytics(mockAnalytics);
      }
      
      if (clonesData.status === 'fulfilled' && clonesData.value.data) {
        // Map Supabase data to expected format
        const mappedClones = clonesData.value.data.map(clone => ({
          ...clone,
          avatar: clone.avatar_url, // Map avatar_url to avatar for backward compatibility
          type: clone.category, // Map category to type for the UI
          status: clone.is_active ? 'active' : 'draft' // Map is_active to status
        }));
        setClones(mappedClones);
      }
      
      if (sessionsData.status === 'fulfilled' && sessionsData.value.data) {
        setSessions(sessionsData.value.data);
      }
      
      // If any critical data failed, show error
      if (creatorData.status === 'rejected') {
        setError(creatorData.reason.message);
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

  const createUserProfile = useCallback(async (userId: string) => {
    try {
      // Get user data from Supabase auth to populate profile
      const { supabase, supabaseAuth } = await import('@/lib/supabase');
      const user = await supabaseAuth.getUser();
      
      if (!user) throw new Error('No authenticated user found');
      
      const profileData = {
        id: userId,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || 'User',
        role: user.user_metadata?.role || 'user',
        is_active: true,
        is_verified: !!user.email_confirmed_at,
        hashed_password: '', // This should be handled by auth system
        preferences: {},
        timezone: 'UTC',
        language: 'en',
        subscription_tier: 'free',
        credits_remaining: 100,
        total_spent: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('user_profiles')
        .insert([profileData]);
        
      if (error) throw error;
      console.log('User profile created successfully');
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // Fetch profile from Supabase 'user_profiles' table
      const { data, error } = await import('@/lib/supabase').then(({ supabase }) =>
        supabase.from('user_profiles').select('*').eq('id', userId).single()
      );
      if (error) {
        // If user profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('User profile not found, creating one...');
          await createUserProfile(userId);
          // Retry fetching after creation
          const { data: newData, error: newError } = await import('@/lib/supabase').then(({ supabase }) =>
            supabase.from('user_profiles').select('*').eq('id', userId).single()
          );
          if (newError) throw newError;
          setProfile(newData);
        } else {
          throw error;
        }
      } else if (data) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      console.error('User ID:', userId);
      setError(err instanceof Error ? err.message : 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateProfile = useCallback(async (profileData: any) => {
    try {
      setUpdating(true);
      setError(null);
      // Update profile in Supabase 'user_profiles' table
      const { error } = await import('@/lib/supabase').then(({ supabase }) =>
        supabase.from('user_profiles').update(profileData).eq('id', userId)
      );
      if (error) throw error;
      // Refresh profile after update
      await fetchProfile();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      return false;
    } finally {
      setUpdating(false);
    }
  }, [userId, fetchProfile]);

  const updatePreferences = useCallback(async (preferences: any) => {
    try {
      setUpdating(true);
      setError(null);
      
      // Update preferences in the profile
      setProfile(prev => ({
        ...prev,
        preferences: { ...prev?.preferences, ...preferences }
      }));
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
      return false;
    } finally {
      setUpdating(false);
    }
  }, []);

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
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get user profile for billing info
      const { supabase } = await import('@/lib/supabase');
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('total_spent, subscription_tier, credits_remaining')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      
      // Get recent sessions for billing history
      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, total_cost, created_at, rate_per_minute, duration_minutes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (sessionError) throw sessionError;
      
      const billingInfo = {
        currentPlan: userProfile?.subscription_tier || 'free',
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        paymentMethod: 'Not configured'
      };
      
      const billingHistory = (sessions || []).map((session: any) => ({
        id: session.id,
        amount: session.total_cost || 0,
        date: session.created_at,
        description: `Session (${session.duration_minutes || 0} minutes)`,
        status: 'completed'
      }));
      
      setBillingInfo(billingInfo);
      setBillingHistory(billingHistory);
      
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
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment method');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

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
      
      // For now, we'll use clones as favorites since we don't have a favorites table
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('clones')
        .select('*')
        .eq('creator_id', userId)
        .limit(10);
      
      if (error) throw error;
      setFavorites(data || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addToFavorites = useCallback(async (cloneId: string) => {
    try {
      setError(null);
      
      // Since we don't have a favorites table, this is a placeholder
      // In a real implementation, you'd create a user_favorites table
      console.log(`Adding clone ${cloneId} to favorites for user ${userId}`);
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
      
      // Since we don't have a favorites table, this is a placeholder
      // In a real implementation, you'd delete from user_favorites table
      console.log(`Removing clone ${cloneId} from favorites for user ${userId}`);
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