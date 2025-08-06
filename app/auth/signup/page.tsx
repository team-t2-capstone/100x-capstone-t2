import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Sign Up - CloneAI',
  description: 'Create your CloneAI account',
};