'use client';

import dynamic from 'next/dynamic';

// Dynamically import the forgot password form with SSR disabled
const ForgotPasswordForm = dynamic(
  () => import('@/components/auth/forgot-password-form').then((mod) => mod.ForgotPasswordForm),
  { ssr: false }
);

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

// Metadata is defined in layout.tsx instead to avoid SSR issues