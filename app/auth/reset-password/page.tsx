'use client';

import dynamic from 'next/dynamic';

// Dynamically import the reset password form with SSR disabled
const ResetPasswordForm = dynamic(
  () => import('@/components/auth/reset-password-form').then((mod) => mod.ResetPasswordForm),
  { ssr: false }
);

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  );
}

// Metadata is defined in layout.tsx instead to avoid SSR issues