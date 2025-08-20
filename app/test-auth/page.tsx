'use client';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/auth-api';
import { useState } from 'react';

export default function AuthTestPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const testBackendConnection = async () => {
    setTesting(true);
    try {
      const health = await authApi.checkHealth();
      setHealthStatus(health);
    } catch (error) {
      setHealthStatus({ error: error.message });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading authentication status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Test Page</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Authentication Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {isAuthenticated ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mr-2" />
                )}
                Authentication Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Status:</strong> {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</p>
                {user && (
                  <>
                    <p><strong>User ID:</strong> {user.id}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Name:</strong> {user.full_name}</p>
                    <p><strong>Role:</strong> {user.role}</p>
                    <p><strong>Email Confirmed:</strong> {user.email_confirmed ? 'Yes' : 'No'}</p>
                    <p><strong>Subscription:</strong> {user.subscription_tier || 'Free'}</p>
                    <p><strong>Credits:</strong> {user.credits_remaining || 'N/A'}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Backend Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Backend Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={testBackendConnection}
                  disabled={testing}
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Testing...
                    </>
                  ) : (
                    'Test Backend Connection'
                  )}
                </Button>

                {healthStatus && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(healthStatus, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Links */}
        <Card>
          <CardHeader>
            <CardTitle>Test Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" asChild>
                <a href="/auth/login">Login Page</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/auth/signup">Signup Page</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/dashboard">Dashboard (Protected)</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/create-clone">Create Clone (Creator Only)</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}