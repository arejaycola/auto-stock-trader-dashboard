import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function withAuth(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  return session
}

export async function withRateLimit(request: NextRequest, limit: number = 10, window: number = 60000) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  
  // In a real implementation, you'd use Redis or a database for rate limiting
  // This is a simple in-memory implementation for demonstration
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
  
  const current = rateLimitMap.get(clientIP)
  
  if (current && now < current.resetTime) {
    if (current.count >= limit) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${limit} per ${window/1000} seconds.`,
          resetTime: current.resetTime
        },
        { status: 429 }
      )
    }
    current.count++
  } else {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + window })
  }
  
  return null // No rate limit error
}

export function validateTradingSession(request: NextRequest) {
  const session = request.headers.get('x-trading-session')
  const apiKey = request.headers.get('x-api-key')
  
  // Allow internal API calls or ones with valid session
  if (apiKey === process.env.INTERNAL_API_KEY || session === 'active') {
    return true
  }
  
  return false
}

export function logApiCall(request: NextRequest, response: NextResponse, startTime: number) {
  const duration = Date.now() - startTime
  const timestamp = new Date().toISOString()
  
  console.log(`[${timestamp}] ${request.method} ${request.url} - ${response.status} - ${duration}ms`)
  
  // In production, you'd send this to your logging service
  // Examples: Datadog, LogRocket, Sentry, etc.
}

export function handleApiError(error: any, request: NextRequest) {
  console.error(`API Error in ${request.method} ${request.url}:`, error)
  
  // Don't expose internal error details to client
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return NextResponse.json(
    {
      error: 'Internal server error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
    },
    { status: 500 }
  )
}