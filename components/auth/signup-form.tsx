'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { validatePassword } from '@/lib/auth-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be less than 100 characters'),
  role: z.enum(['user', 'creator'], {
    required_error: 'Please select a role',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  const validation = validatePassword(data.password);
  return validation.isValid;
}, {
  message: "Password must contain uppercase, lowercase, and number",
  path: ["password"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [accountConflict, setAccountConflict] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const { signup, error, clearError } = useAuth();
  const router = useRouter();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      role: undefined,
    },
  });

  const watchPassword = form.watch('password');
  const passwordValidation = watchPassword ? validatePassword(watchPassword) : { isValid: false, errors: [] };

  const onSubmit = async (data: SignupFormData) => {
    try {
      setIsLoading(true);
      clearError();
      
      await signup({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        role: data.role,
      });
      
      // Show success message for email verification
      setRegistrationSuccess(true);
      
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message === 'ALREADY_REGISTERED') {
          // Handle "already registered" case with custom UI - completely silent
          setAlreadyRegistered(true);
          setRegisteredEmail(data.email);
          clearError(); // Clear the error since we're handling it with a custom UI
          // Don't log anything for this expected user flow
        } else if (error.message === 'ACCOUNT_CONFLICT') {
          // Handle account conflict case - user exists in Supabase auth but not in our database
          setAccountConflict(true);
          setRegisteredEmail(data.email);
          clearError(); // Clear the error since we're handling it with a custom UI
        } else if (error.message === 'SIGNUP_FAILED') {
          // Keep generic error message for database issues
          console.error('Signup failed - database error:', 'Service temporarily unavailable');
        } else {
          console.error('Signup failed:', error);
        }
      } else {
        console.error('Signup failed:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (accountConflict) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-orange-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Account Recovery Needed
          </CardTitle>
          <CardDescription className="text-center">
            There's an issue with the account for <strong>{registeredEmail}</strong>. 
            Please contact support or try signing up with a different email address.
          </CardDescription>
        </CardHeader>
        
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            onClick={() => {
              setAccountConflict(false);
              setRegisteredEmail('');
              form.reset();
            }}
            className="w-full"
          >
            Try Different Email
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Need help? Contact support for assistance with account recovery.
          </div>
        </CardFooter>
      </Card>
    );
  }

  if (alreadyRegistered) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Account Already Exists
          </CardTitle>
          <CardDescription className="text-center">
            An account with <strong>{registeredEmail}</strong> already exists. 
            You can sign in with your existing credentials.
          </CardDescription>
        </CardHeader>
        
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            onClick={() => router.push('/auth/login')}
            className="w-full"
          >
            Go to Sign In
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setAlreadyRegistered(false);
              setRegisteredEmail('');
              form.reset();
            }}
            className="w-full"
          >
            Try Different Email
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Forgot your password?{' '}
            <Link 
              href="/auth/forgot-password" 
              className="text-primary hover:underline font-medium"
            >
              Reset it here
            </Link>
          </div>
        </CardFooter>
      </Card>
    );
  }

  if (registrationSuccess) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Registration Successful!
          </CardTitle>
          <CardDescription className="text-center">
            Your account has been created successfully. You can now sign in with your credentials.
          </CardDescription>
        </CardHeader>
        
        <CardFooter className="flex flex-col space-y-2">
          <Button 
            onClick={() => router.push('/auth/login')}
            className="w-full"
          >
            Go to Sign In
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Create your account
        </CardTitle>
        <CardDescription className="text-center">
          Join CloneAI to create and interact with AI clones
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && !alreadyRegistered && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error.includes('Database error') || error.includes('AuthApiError') 
                ? 'Unable to create account. Please try again later.' 
                : error}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your full name"
                      autoComplete="name"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User - Chat with existing AI clones</SelectItem>
                      <SelectItem value="creator">Creator - Create and manage AI clones</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        disabled={isLoading}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  {watchPassword && (
                    <div className="text-xs space-y-1">
                      {passwordValidation.errors.map((error, index) => (
                        <div key={index} className="text-destructive">
                          • {error}
                        </div>
                      ))}
                      {passwordValidation.isValid && (
                        <div className="text-green-600">✓ Password meets requirements</div>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        disabled={isLoading}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !passwordValidation.isValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2">
        <div className="text-xs text-center text-muted-foreground">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </div>
        
        <div className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link 
            href="/auth/login" 
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}