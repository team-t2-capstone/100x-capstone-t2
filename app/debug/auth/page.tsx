'use client';

import { RequireAuth } from '@/components/auth/protected-route';
import AuthTest from '@/components/debug/auth-test';

export default function AuthDebugPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Authentication Debug</h1>
            <p className="text-gray-600">
              This page helps debug authentication issues, particularly the 403 Forbidden error when deleting clones.
            </p>
          </div>
          
          <AuthTest />
          
          <div className="mt-8 p-6 bg-blue-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">How to Test the Clone Delete Fix</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>First, click "Debug Auth State" to verify your authentication is working</li>
              <li>Click "Test Backend Auth" to confirm the backend can authenticate your requests</li>
              <li>Click "Test Clone Delete Auth" to test if clone deletion auth is working</li>
              <li>If you see a "404 not found" error, that's good - it means auth is working</li>
              <li>If you see a "403 forbidden" error, the authentication fix still needs work</li>
              <li>Go to the Creator Dashboard and try deleting a real clone</li>
            </ol>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}