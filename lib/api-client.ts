/**
 * API Client for CloneAI Backend
 * Handles HTTP requests to the FastAPI backend with authentication
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import Cookies from 'js-cookie';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';
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
    (config) => {
      const token = Cookies.get(TOKEN_KEYS.ACCESS_TOKEN);
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
      
      // Handle 401 Unauthorized - token might be expired
      if (error.response?.status === 401 && originalRequest) {
        const refreshToken = Cookies.get(TOKEN_KEYS.REFRESH_TOKEN);
        
        if (refreshToken) {
          try {
            // Attempt to refresh the token
            const refreshResponse = await axios.post(`${API_BASE_URL}${API_V1_PREFIX}/auth/refresh`, {
              refresh_token: refreshToken,
            });

            const { access_token, refresh_token: newRefreshToken } = refreshResponse.data;
            
            // Store new tokens
            Cookies.set(TOKEN_KEYS.ACCESS_TOKEN, access_token, {
              expires: 1, // 1 day
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
            });
            
            if (newRefreshToken) {
              Cookies.set(TOKEN_KEYS.REFRESH_TOKEN, newRefreshToken, {
                expires: 7, // 7 days
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
              });
            }

            // Retry the original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
            }
            return client(originalRequest);
          } catch (refreshError) {
            // Refresh failed - redirect to login
            clearAuthTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token - redirect to login
          clearAuthTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
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
export const isAuthenticated = (): boolean => {
  const { accessToken, refreshToken } = getAuthTokens();
  return !!(accessToken || refreshToken);
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