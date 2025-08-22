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
  role: 'user' | 'creator';
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
  
  // Create stable supabase client only in browser environment
  const supabase = React.useMemo(() => {
    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) {
      // Return dummy client during SSR/build
      return {} as ReturnType<typeof createClient>;
    }
    return createClient();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth state on mount using Supabase session
  const initializeAuth = useCallback(async () => {
    try {
      // Check if we're in a browser environment
      const isBrowser = typeof window !== 'undefined';
      if (!isBrowser) {
        // Skip initialization during SSR/build
        setLoading(false);
        return;
      }
      
      console.log('[AUTH] Initializing auth state...');
      
      // Get current session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth?.getSession?.() || { data: { session: null }, error: null };
      
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
          .from?.('user_profiles')
          ?.select?.('*')
          ?.eq?.('id', session.user.id)
          ?.single?.() || { data: null, error: new Error('Supabase client not available') };
        
        if (profileError) {
          console.error('Failed to fetch user profile:', profileError);
          // If profile doesn't exist, user might need to complete signup
          setUser(null);
        } else if (profile) {
          // Type assertion to avoid TypeScript errors
          const typedProfile = profile as unknown as User;
          console.log('[AUTH] Successfully loaded user profile:', typedProfile.full_name);
          setUser(typedProfile);
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
      // Check if we're in a browser environment
      const isBrowser = typeof window !== 'undefined';
      if (!isBrowser) {
        throw new Error('Cannot login during server-side rendering');
      }
      
      console.log('Starting login process for:', credentials.email);
      setLoading(true);
      setError(null);
      
      // Temporarily suppress console.error to prevent Supabase from logging "Invalid login credentials"
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        // Check if this is the "Invalid login credentials" error from Supabase
        const isInvalidCredentialsError = args.some(arg => 
          (typeof arg === 'string' && arg.includes('Invalid login credentials')) ||
          (arg && typeof arg === 'object' && arg.message && arg.message.includes('Invalid login credentials'))
        );
        
        // Only log if it's not the "invalid credentials" error
        if (!isInvalidCredentialsError) {
          originalConsoleError.apply(console, args);
        }
      };
      
      let authResult;
      try {
        // Normalize email input
        console.log('Attempting login with email:', credentials.email);
        
        // Use Supabase client to authenticate
        authResult = await supabase.auth?.signInWithPassword?.({ 
          email: credentials.email.trim().toLowerCase(), // Normalize email
          password: credentials.password,
        }) || { data: { session: null }, error: new Error('Supabase client not available') };
      } finally {
        // Always restore console.error
        console.error = originalConsoleError;
      }
      
      const { data, error: authError } = authResult;
      
      if (authError) {
        throw authError;
      }
      
      if (!data?.session?.user) {
        console.error('No session returned from login');
        throw new Error('Authentication failed - no session returned');
      }
      
      console.log('Authentication successful, fetching profile...');
      
      // Fetch user profile from database
      const { data: profile, error: profileError } = await supabase
        .from?.('user_profiles')
        ?.select?.('*')
        ?.eq?.('id', data.session.user.id)
        ?.single?.() || { data: null, error: new Error('Supabase client not available') };
      
      if (profileError) {
        throw new Error('Failed to load user profile');
      }
      
      if (!profile) {
        throw new Error('User profile not found');
      }
      
      // Type assertion to avoid TypeScript errors
      const typedProfile = profile as unknown as User;
      console.log('Login successful for:', typedProfile.full_name);
      
      // Store auth tokens for API client
      if (data.session?.access_token && data.session?.refresh_token) {
        storeAuthTokens(data.session.access_token, data.session.refresh_token);
      }
      
      setUser(profile as User);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
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
      
      // Temporarily suppress console.error to prevent Supabase from logging "User already registered"
      const originalConsoleError = console.error;
      console.error = (...args: any[]) => {
        // Check if this is the "User already registered" error from Supabase
        const isAlreadyRegisteredError = args.some(arg => 
          (typeof arg === 'string' && arg.includes('User already registered')) ||
          (arg && typeof arg === 'object' && arg.message && arg.message.includes('User already registered'))
        );
        
        // Only log if it's not the "already registered" error
        if (!isAlreadyRegisteredError) {
          originalConsoleError.apply(console, args);
        }
      };
      
      let authResult;
      try {
        // Use Supabase client to create user
        authResult = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password,
          options: {
            data: {
              full_name: userData.full_name,
              role: userData.role,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });
      } finally {
        // Always restore console.error
        console.error = originalConsoleError;
      }
      
      const { data, error: authError } = authResult;
      
      // Log detailed error information for debugging (skip already registered case)
      if (authError && !authError.message.includes('User already registered')) {
        console.error('Signup error details:', {
          message: authError.message,
          status: authError.status,
          statusText: authError.status,
          name: authError.name
        });
      }
      
      if (authError) {
        // Handle specific error cases more gracefully
        if (authError.message.includes('User already registered') || authError.message.includes('already registered')) {
          // Check if user actually exists in our database
          try {
            const { data: existingProfile } = await supabase
              .from('user_profiles')
              .select('email, full_name')
              .eq('email', userData.email)
              .single();
            
            if (existingProfile) {
              // User exists in our database - legitimate "already registered" case
              throw new Error('ALREADY_REGISTERED');
            } else {
              // User doesn't exist in our database but Supabase says they do
              // This might be a caching issue or orphaned auth record
              throw new Error('ACCOUNT_CONFLICT');
            }
          } catch (profileCheckError) {
            // If we can't check the profile, assume it's a legitimate "already registered"
            throw new Error('ALREADY_REGISTERED');
          }
        } else if (authError.message.includes('Database error')) {
          console.error('Database error during signup:', authError.message);
          throw new Error('SIGNUP_FAILED');
        } else {
          console.error('Signup error:', authError);
          throw authError;
        }
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
      let errorMessage = 'Registration failed';
      let shouldThrow = true;
      
      if (error instanceof Error) {
        if (error.message === 'ALREADY_REGISTERED') {
          errorMessage = 'This email is already registered';
          // Don't set error for ALREADY_REGISTERED since it's handled in UI
          shouldThrow = true; // Still throw so the component can catch and handle it
        } else if (error.message === 'ACCOUNT_CONFLICT') {
          errorMessage = 'ACCOUNT_CONFLICT';
          // Don't set error for ACCOUNT_CONFLICT since it's handled in UI
          shouldThrow = true; // Still throw so the component can catch and handle it
        } else if (error.message === 'SIGNUP_FAILED') {
          errorMessage = 'Unable to create account. Please try again later.';
        } else if (error.message.includes('Database error')) {
          errorMessage = 'Service temporarily unavailable. Please try again later.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Please enter a valid email address';
        } else if (error.message.includes('Password')) {
          errorMessage = 'Password does not meet requirements';
        } else {
          errorMessage = error.message;
        }
      }
      
      // Only set error state for non-ALREADY_REGISTERED and non-ACCOUNT_CONFLICT cases
      if (!(error instanceof Error) || (error.message !== 'ALREADY_REGISTERED' && error.message !== 'ACCOUNT_CONFLICT')) {
        setError(errorMessage);
      }
      
      if (shouldThrow) {
        throw error;
      }
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