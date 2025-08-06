'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireRole?: 'user' | 'creator' | 'admin';
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  requireRole,
  redirectTo = '/auth/login' 
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      if (requireRole && user && user.role !== requireRole) {
        // Redirect to appropriate page based on role
        if (user.role === 'user') {
          router.push('/dashboard');
        } else if (user.role === 'creator') {
          router.push('/dashboard/creator');
        } else {
          router.push('/');
        }
        return;
      }
    }
  }, [loading, isAuthenticated, user, requireAuth, requireRole, redirectTo, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  if (requireRole && user && user.role !== requireRole) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

// Convenience components for common use cases
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true}>
      {children}
    </ProtectedRoute>
  );
}

export function RequireCreator({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true} requireRole="creator">
      {children}
    </ProtectedRoute>
  );
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireAuth={true} requireRole="admin">
      {children}
    </ProtectedRoute>
  );
}