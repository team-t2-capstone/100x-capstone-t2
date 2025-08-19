'use client';

/**
 * Authentication Context
 * Provides authentication state and functions throughout the app
 * Uses proper Supabase SSR patterns with optimized performance
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { storeAuthTokens, clearAuthTokens } from '@/lib/api-client';
import type { Database } from '@/types/database';

// Types
type Profile = Database['public']['Tables']['user_profiles']['Row'];

interface User extends Profile {
  // Extends the profile with additional auth properties if needed
}

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
}

interface AuthContextType {
  // State
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (userData: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncTokens: () => Promise<void>;
  
  // Error state
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create stable supabase client - moved outside of render cycle
  const supabase = React.useMemo(() => createClient(), []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth state on mount using Supabase session
  const initializeAuth = useCallback(async () => {
    try {
      console.log('[AUTH] Initializing auth state...');
      
      // Get current session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error during init:', sessionError);
        throw sessionError;
      }
      
      if (session?.user) {
        console.log('[AUTH] Found active session for user:', session.user.id);
        
        // Store auth tokens for API client
        if (session.access_token && session.refresh_token) {
          storeAuthTokens(session.access_token, session.refresh_token);
        }
        
        // Fetch user profile from database
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('Failed to fetch user profile:', profileError);
          // If profile doesn't exist, user might need to complete signup
          setUser(null);
        } else {
          console.log('[AUTH] Successfully loaded user profile:', profile.full_name);
          setUser(profile);
        }
      } else {
        console.log('[AUTH] No active session found');
        // No active session - clear tokens
        clearAuthTokens();
        setUser(null);
      }
    } catch (error) {
      console.error('[AUTH] Initialization failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setUser(null);
        return;
      }

      // Fetch fresh user profile from database
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
        console.error('Failed to refresh user profile:', profileError);
        setError('Failed to load user information');
      } else {
        setUser(profile);
        setError(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setError('Failed to load user information');
    }
  }, [supabase]);

  // Sync tokens with API client
  const syncTokens = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        storeAuthTokens(session.access_token, session.refresh_token);
        console.log('[AUTH] Tokens synchronized with API client');
      } else {
        clearAuthTokens();
        console.log('[AUTH] No session found, cleared stored tokens');
      }
    } catch (error) {
      console.error('[AUTH] Failed to sync tokens:', error);
      clearAuthTokens();
    }
  }, [supabase]);

  // Login function using Supabase directly
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      console.log('Starting login process for:', credentials.email);
      setLoading(true);
      setError(null);
      
      // Use Supabase client to authenticate
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      
      if (authError) {
        console.error('Authentication error:', authError);
        throw authError;
      }
      
      if (!data.session?.user) {
        console.error('No session returned from login');
        throw new Error('Authentication failed - no session returned');
      }
      
      console.log('Authentication successful, fetching profile...');
      
      // Fetch user profile from database
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
      
      if (profileError) {
        console.error('Failed to fetch user profile after login:', profileError);
        throw new Error('Failed to load user profile');
      }
      
      console.log('Login successful for:', profile.full_name);
      
      // Store auth tokens for API client
      if (data.session?.access_token && data.session?.refresh_token) {
        storeAuthTokens(data.session.access_token, data.session.refresh_token);
      }
      
      setUser(profile);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('Login process failed:', errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Signup function
  const signup = useCallback(async (userData: SignupRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use Supabase client to create user
      const { data, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      
      if (authError) {
        throw authError;
      }
      
      // If email confirmation is required, user will be null initially
      // Profile will be created automatically by the database trigger
      if (data.session?.user) {
        // User is automatically confirmed (unlikely in production)
        // Store auth tokens for API client
        if (data.session?.access_token && data.session?.refresh_token) {
          storeAuthTokens(data.session.access_token, data.session.refresh_token);
        }
        
        // Fetch user profile directly to avoid circular dependency
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        
        if (!profileError && profile) {
          setUser(profile);
        } else {
          setUser(null);
        }
      } else {
        // Email confirmation required - user will need to check email
        setUser(null);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Logout function using Supabase
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Sign out with Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local state and tokens
      clearAuthTokens();
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, [supabase]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Listen for auth changes from Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] State changed:', event, session?.user?.id);
        
        if (event === 'SIGNED_OUT') {
          console.log('[AUTH] User signed out');
          clearAuthTokens();
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[AUTH] Token refreshed - updating stored tokens');
          // Update stored tokens when Supabase refreshes them
          if (session?.access_token && session?.refresh_token) {
            storeAuthTokens(session.access_token, session.refresh_token);
          }
          // Don't refresh user data here to avoid conflicts with other flows
        } else if (event === 'SIGNED_IN' && session?.user) {
          console.log('[AUTH] User signed in - updating stored tokens');
          // Store tokens when user signs in
          if (session?.access_token && session?.refresh_token) {
            storeAuthTokens(session.access_token, session.refresh_token);
          }
          // Don't fetch profile here to avoid conflicts with login function
        }
        
        // Note: Loading state is managed by initializeAuth and login functions
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshUser,
    syncTokens,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};