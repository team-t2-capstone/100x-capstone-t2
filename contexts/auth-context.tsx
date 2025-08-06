'use client';

/**
 * Authentication Context
 * Provides authentication state and functions throughout the app
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, User, LoginRequest, SignupRequest } from '@/lib/auth-api';
import { storeAuthTokens, clearAuthTokens, getAuthTokens, isAuthenticated } from '@/lib/api-client';

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

  // Initialize auth state on mount
  const initializeAuth = useCallback(async () => {
    try {
      if (isAuthenticated()) {
        // Try to get current user info
        const userData = await authApi.getCurrentUser();
        setUser(userData);
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

  // Login function
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);
      
      const authResponse = await authApi.login(credentials);
      
      // Store tokens
      storeAuthTokens(authResponse.access_token, authResponse.refresh_token);
      
      // Set user data
      setUser(authResponse.user);
      
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

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // Call logout API (best effort)
      await authApi.logout();
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