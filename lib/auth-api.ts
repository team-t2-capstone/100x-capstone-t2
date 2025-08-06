/**
 * Authentication API Functions
 * Functions for user registration, login, logout, and user management
 */
import { apiClient, parseApiError } from './api-client';
import type { AxiosError } from 'axios';

// User Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'creator' | 'admin';
  email_confirmed: boolean;
  created_at: string;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
  credits_remaining?: number;
}

// Authentication Types
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  role?: 'user' | 'creator';
}

export interface UserInfoResponse {
  user_id: string;
  role: string;
  email_verified: boolean;
  permissions: Record<string, boolean>;
}

export interface AuthHealthResponse {
  status: string;
  supabase_auth: string;
  jwt_secret_configured: boolean;
  timestamp: string;
}

// Authentication API Functions
export const authApi = {
  /**
   * Check authentication service health
   */
  async checkHealth(): Promise<AuthHealthResponse> {
    try {
      const response = await apiClient.get('/auth/health');
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Auth health check failed: ${apiError.message}`);
    }
  },

  /**
   * Register a new user
   */
  async signup(userData: SignupRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/signup', {
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        role: userData.role || 'user',
      });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Login user with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Even if logout fails on server, we should clear local tokens
      console.error('Logout error:', error);
    }
  },

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to get user info: ${apiError.message}`);
    }
  },

  /**
   * Get detailed user info with permissions
   */
  async getUserInfo(): Promise<UserInfoResponse> {
    try {
      const response = await apiClient.get('/auth/user-info');
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Failed to get user info: ${apiError.message}`);
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(`Token refresh failed: ${apiError.message}`);
    }
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post('/auth/reset-password', { email });
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },

  /**
   * Resend email verification
   */
  async resendVerification(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post('/auth/resend-verification');
      return response.data;
    } catch (error) {
      const apiError = parseApiError(error as AxiosError);
      throw new Error(apiError.message);
    }
  },
};

// Validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateFullName = (fullName: string): boolean => {
  return fullName.trim().length >= 2 && fullName.trim().length <= 100;
};