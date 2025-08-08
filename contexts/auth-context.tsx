'use client';

/**
 * Authentication Context
 * Provides authentication state and functions throughout the app
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, User, LoginRequest, SignupRequest } from '@/lib/auth-api';
import { storeAuthTokens, clearAuthTokens, getAuthTokens, isAuthenticated } from '@/lib/api-client';
import { supabase, supabaseAuth } from '@/lib/supabase';

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize auth state on mount using Supabase session
  const initializeAuth = useCallback(async () => {
    try {
      // Get current session from Supabase
      const session = await supabaseAuth.getSession();
      
      if (session && session.user) {
        // Store tokens from session
        storeAuthTokens(session.access_token, session.refresh_token);
        
        // Set user data from Supabase user
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name || '',
          role: session.user.user_metadata?.role || 'user',
          email_confirmed: !!session.user.email_confirmed_at,
          created_at: session.user.created_at,
          subscription_tier: 'free',
          credits_remaining: 100,
        };
        
        setUser(userData);
      } else {
        // No active session
        clearAuthTokens();
        setUser(null);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      // Clear invalid tokens
      clearAuthTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUser(null);
      return;
    }

    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      setError(null);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setError('Failed to load user information');
      // Don't clear tokens here as it might be a temporary network issue
    }
  }, []);

  // Login function using Supabase directly
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use Supabase client to authenticate
      const { session, user } = await supabaseAuth.signIn(credentials.email, credentials.password);
      
      if (!session || !user) {
        throw new Error('Authentication failed');
      }
      
      // Store Supabase tokens
      storeAuthTokens(session.access_token, session.refresh_token);
      
      // Set user data from Supabase user
      const userData: User = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        role: user.user_metadata?.role || 'user',
        email_confirmed: !!user.email_confirmed_at,
        created_at: user.created_at,
        subscription_tier: 'free',
        credits_remaining: 100,
      };
      
      setUser(userData);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Signup function
  const signup = useCallback(async (userData: SignupRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      const authResponse = await authApi.signup(userData);
      
      // Check if we got tokens (might not if email verification required)
      if (authResponse.access_token && authResponse.refresh_token) {
        storeAuthTokens(authResponse.access_token, authResponse.refresh_token);
        setUser(authResponse.user);
      } else {
        // Registration successful but email verification required
        setUser(null);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function using Supabase
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Sign out with Supabase
      await supabaseAuth.signOut();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local state and tokens
      clearAuthTokens();
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Listen for storage events (logout from another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cloneai_access_token' && e.newValue === null) {
        // Token was cleared in another tab
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    refreshUser,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};