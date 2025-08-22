'use client';

import dynamic from 'next/dynamic';

// Dynamically import the signup form with SSR disabled
const SignupForm = dynamic(
  () => import('@/components/auth/signup-form').then((mod) => mod.SignupForm),
  { ssr: false }
);

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}

// Metadata is defined in layout.tsx instead to avoid SSR issues