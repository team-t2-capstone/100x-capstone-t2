/**
 * API Client for CloneAI Backend
 * Handles HTTP requests to the FastAPI backend with Supabase authentication
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';
import { createClient } from '@/utils/supabase/client';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const API_V1_PREFIX = '/api/v1';

// Token storage keys
export const TOKEN_KEYS = {
  ACCESS_TOKEN: 'cloneai_access_token',
  REFRESH_TOKEN: 'cloneai_refresh_token',
} as const;

// Create axios instance with default configuration
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${API_BASE_URL}${API_V1_PREFIX}`,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add authentication token
  client.interceptors.request.use(
    async (config) => {
      // First try to get token from cookies (for backwards compatibility)
      let token = Cookies.get(TOKEN_KEYS.ACCESS_TOKEN);
      
      // If no token in cookies, get from Supabase session
      if (!token) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            token = session.access_token;
            // Optionally store in cookie for future requests
            Cookies.set(TOKEN_KEYS.ACCESS_TOKEN, token, {
              expires: 1, // 1 day
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
            });
          }
        } catch (error) {
          console.error('Failed to get Supabase session:', error);
        }
      }
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle token refresh and errors
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;
      
      // Handle 401/403 Unauthorized - token might be expired or invalid
      if ((error.response?.status === 401 || error.response?.status === 403) && originalRequest) {
        try {
          // Try to refresh using Supabase session
          const supabase = createClient();
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (!sessionError && session?.access_token) {
            // Update token in cookies
            Cookies.set(TOKEN_KEYS.ACCESS_TOKEN, session.access_token, {
              expires: 1, // 1 day
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
            });
            
            if (session.refresh_token) {
              Cookies.set(TOKEN_KEYS.REFRESH_TOKEN, session.refresh_token, {
                expires: 7, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
              });
            }
            
            // Retry the original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
            }
            return client(originalRequest);
          } else {
            // No valid session - redirect to login
            clearAuthTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Refresh failed - redirect to login
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create the API client instance
export const apiClient = createApiClient();

// Auth token management utilities
export const storeAuthTokens = (accessToken: string, refreshToken: string) => {
  Cookies.set(TOKEN_KEYS.ACCESS_TOKEN, accessToken, {
    expires: 1, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  
  Cookies.set(TOKEN_KEYS.REFRESH_TOKEN, refreshToken, {
    expires: 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};

export const getAuthTokens = () => {
  return {
    accessToken: Cookies.get(TOKEN_KEYS.ACCESS_TOKEN),
    refreshToken: Cookies.get(TOKEN_KEYS.REFRESH_TOKEN),
  };
};

export const clearAuthTokens = () => {
  Cookies.remove(TOKEN_KEYS.ACCESS_TOKEN);
  Cookies.remove(TOKEN_KEYS.REFRESH_TOKEN);
};

// Check if user is authenticated
export const isAuthenticated = async (): Promise<boolean> => {
  // First check cookies
  const { accessToken, refreshToken } = getAuthTokens();
  if (accessToken || refreshToken) {
    return true;
  }
  
  // Then check Supabase session
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return !!session?.access_token;
  } catch (error) {
    console.error('Failed to check Supabase authentication:', error);
    return false;
  }
};

// API Error types
export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

// Parse API error response
export const parseApiError = (error: AxiosError): ApiError => {
  const status = error.response?.status || 500;
  const responseData = error.response?.data as any;
  
  let message = 'An unexpected error occurred';
  
  if (responseData?.detail) {
    message = typeof responseData.detail === 'string' 
      ? responseData.detail 
      : responseData.detail?.message || message;
  } else if (responseData?.message) {
    message = responseData.message;
  } else if (error.message) {
    message = error.message;
  }

  return {
    message,
    status,
    code: responseData?.code,
  };
};

// Health check utility
export const checkApiHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    return {
      status: 'healthy',
      data: response.data,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Debug authentication helper
export const debugAuthentication = async () => {
  try {
    const { accessToken, refreshToken } = getAuthTokens();
    
    // Check Supabase session
    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    return {
      cookieTokens: {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
      },
      supabaseSession: {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        hasRefreshToken: !!session?.refresh_token,
        userId: session?.user?.id,
        email: session?.user?.email,
        sessionError: sessionError?.message,
      },
      isAuthenticated: !!(accessToken || session?.access_token),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      isAuthenticated: false,
    };
  }
};

// Test authentication endpoint
export const testAuthentication = async () => {
  try {
    const response = await apiClient.get('/clones/test-auth');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    const apiError = parseApiError(error as AxiosError);
    return {
      success: false,
      error: apiError.message,
      status: apiError.status,
    };
  }
};