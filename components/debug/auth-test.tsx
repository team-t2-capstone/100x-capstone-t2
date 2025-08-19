'use client';

import React, { useState } from 'react';
import { testAuthentication, debugAuthentication, deleteClone } from '@/lib/dashboard-api';
import { useAuth } from '@/contexts/auth-context';

interface AuthTestResult {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

interface DebugResult {
  cookieTokens: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    accessTokenLength: number;
  };
  supabaseSession: {
    hasSession: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    userId?: string;
    email?: string;
    sessionError?: string;
  };
  isAuthenticated: boolean;
  error?: string;
}

export const AuthTest: React.FC = () => {
  const { user, syncTokens } = useAuth();
  const [testResult, setTestResult] = useState<AuthTestResult | null>(null);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestAuth = async () => {
    setLoading(true);
    try {
      const result = await testAuthentication();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDebugAuth = async () => {
    setLoading(true);
    try {
      const result = await debugAuthentication();
      setDebugResult(result);
    } catch (error) {
      setDebugResult({
        cookieTokens: { hasAccessToken: false, hasRefreshToken: false, accessTokenLength: 0 },
        supabaseSession: { hasSession: false, hasAccessToken: false, hasRefreshToken: false },
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTokens = async () => {
    setLoading(true);
    try {
      await syncTokens();
      console.log('Tokens synced successfully');
    } catch (error) {
      console.error('Failed to sync tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestDelete = async () => {
    const testCloneId = 'test-clone-id-that-does-not-exist';
    setLoading(true);
    try {
      // This should fail with a 404 (clone not found) rather than 403 (forbidden)
      // A 403 would indicate auth issues, 404 would indicate auth is working
      const result = await deleteClone(testCloneId);
      setDeleteResult({ success: true, message: 'Unexpected success', result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = errorMessage.includes('403') || errorMessage.includes('forbidden') || errorMessage.includes('authentication');
      const isNotFoundError = errorMessage.includes('404') || errorMessage.includes('not found');
      
      setDeleteResult({ 
        success: false, 
        error: errorMessage, 
        isAuthError,
        isNotFoundError,
        analysis: isNotFoundError 
          ? 'Good! This indicates authentication is working (got 404 instead of 403)'
          : isAuthError 
            ? 'Bad! This indicates authentication issues (403 forbidden)'
            : 'Uncertain - unexpected error type'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Authentication Debug Panel</h2>
      
      {/* Current Auth State */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Current Auth State</h3>
        <p><strong>User:</strong> {user ? `${user.full_name} (${user.email})` : 'Not authenticated'}</p>
        <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleTestAuth}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Backend Auth
        </button>
        
        <button
          onClick={handleDebugAuth}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Debug Auth State
        </button>
        
        <button
          onClick={handleSyncTokens}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Sync Tokens
        </button>
        
        <button
          onClick={handleTestDelete}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          Test Clone Delete Auth
        </button>
      </div>

      {/* Test Results */}
      {testResult && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Backend Auth Test Result</h3>
          <div className={`p-3 rounded ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p><strong>Success:</strong> {testResult.success ? 'Yes' : 'No'}</p>
            {testResult.data && (
              <div className="mt-2">
                <p><strong>User ID:</strong> {testResult.data.user_id}</p>
                <p><strong>Message:</strong> {testResult.data.message}</p>
                <p><strong>Token Length:</strong> {testResult.data.token_length}</p>
              </div>
            )}
            {testResult.error && (
              <div className="mt-2">
                <p><strong>Error:</strong> {testResult.error}</p>
                <p><strong>Status:</strong> {testResult.status}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Results */}
      {debugResult && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Authentication Debug Info</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Cookie Tokens */}
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Cookie Tokens</h4>
              <p><strong>Has Access Token:</strong> {debugResult.cookieTokens.hasAccessToken ? 'Yes' : 'No'}</p>
              <p><strong>Has Refresh Token:</strong> {debugResult.cookieTokens.hasRefreshToken ? 'Yes' : 'No'}</p>
              <p><strong>Access Token Length:</strong> {debugResult.cookieTokens.accessTokenLength}</p>
            </div>

            {/* Supabase Session */}
            <div className="p-3 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Supabase Session</h4>
              <p><strong>Has Session:</strong> {debugResult.supabaseSession.hasSession ? 'Yes' : 'No'}</p>
              <p><strong>Has Access Token:</strong> {debugResult.supabaseSession.hasAccessToken ? 'Yes' : 'No'}</p>
              <p><strong>Has Refresh Token:</strong> {debugResult.supabaseSession.hasRefreshToken ? 'Yes' : 'No'}</p>
              <p><strong>User ID:</strong> {debugResult.supabaseSession.userId || 'N/A'}</p>
              <p><strong>Email:</strong> {debugResult.supabaseSession.email || 'N/A'}</p>
              {debugResult.supabaseSession.sessionError && (
                <p className="text-red-600"><strong>Error:</strong> {debugResult.supabaseSession.sessionError}</p>
              )}
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p><strong>Overall Authenticated:</strong> {debugResult.isAuthenticated ? 'Yes' : 'No'}</p>
            {debugResult.error && (
              <p className="text-red-600"><strong>Debug Error:</strong> {debugResult.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Delete Test Results */}
      {deleteResult && (
        <div className="mb-6 p-4 bg-white border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Clone Delete Auth Test</h3>
          <div className={`p-3 rounded ${
            deleteResult.isNotFoundError ? 'bg-green-50 border-green-200' : 
            deleteResult.isAuthError ? 'bg-red-50 border-red-200' : 
            'bg-yellow-50 border-yellow-200'
          }`}>
            <p><strong>Test Result:</strong> {deleteResult.success ? 'Success' : 'Failed'}</p>
            {deleteResult.error && (
              <div className="mt-2">
                <p><strong>Error:</strong> {deleteResult.error}</p>
                <p><strong>Auth Error:</strong> {deleteResult.isAuthError ? 'Yes (❌ Bad)' : 'No (✅ Good)'}</p>
                <p><strong>Not Found Error:</strong> {deleteResult.isNotFoundError ? 'Yes (✅ Good)' : 'No'}</p>
                {deleteResult.analysis && (
                  <p className="mt-2 font-semibold"><strong>Analysis:</strong> {deleteResult.analysis}</p>
                )}
              </div>
            )}
            {deleteResult.success && (
              <p className="mt-2 text-yellow-600"><strong>Note:</strong> {deleteResult.message}</p>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2">Testing...</p>
        </div>
      )}
    </div>
  );
};

export default AuthTest;