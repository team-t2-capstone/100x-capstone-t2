import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Get the pathname from the request
  const pathname = request.nextUrl.pathname
  
  console.log('Middleware processing:', pathname)
  
  // Allow all auth routes to pass through without session check
  if (pathname.startsWith('/auth/') || pathname === '/') {
    console.log('Allowing auth route:', pathname)
    return NextResponse.next()
  }
  
  // Update session for all other routes
  const response = await updateSession(request)
  
  console.log('Middleware completed for:', pathname)
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     * - api routes (handled separately)
     * - static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|css|woff|woff2)$).*)',
  ],
}