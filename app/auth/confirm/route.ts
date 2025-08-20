import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  console.log('Auth confirm handler:', { token_hash: !!token_hash, type, code: !!code, next })

  const supabase = await createClient()

  // Handle OTP verification (email confirmation)
  if (token_hash && type) {
    console.log('Verifying OTP token')
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      console.log('OTP verification successful, redirecting to:', next)
      redirect(next)
    } else {
      console.error('OTP verification failed:', error)
    }
  }
  
  // Handle code exchange (OAuth callback)
  if (code) {
    console.log('Exchanging code for session')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('Code exchange successful, redirecting to:', next)
      redirect(next)
    } else {
      console.error('Code exchange failed:', error)
    }
  }

  console.log('Auth confirmation failed, redirecting to error page')
  // redirect the user to an error page with some instructions
  redirect('/auth/auth-code-error')
}