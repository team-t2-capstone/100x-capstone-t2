'use client';

import dynamic from 'next/dynamic';

// Dynamically import the login form with SSR disabled
const LoginForm = dynamic(
  () => import('@/components/auth/login-form').then((mod) => mod.LoginForm),
  { ssr: false }
);

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}

// Metadata is defined in layout.tsx instead to avoid SSR issues