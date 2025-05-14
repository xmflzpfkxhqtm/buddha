import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_UA_FLAG = 'yeondeungapp'

export async function middleware(req: NextRequest) {
  const url  = req.nextUrl
  const path = url.pathname
  const ua   = (req.headers.get('user-agent') || '').toLowerCase()
  const isAppUA = ua.includes(APP_UA_FLAG)

  /* 브라우저 → / (랜딩은 그대로), 앱 → /dashboard 로 */
  if (path === '/' && isAppUA) {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  /* 브라우저가 앱 내부 경로 접근하면 / (랜딩) 로 다시 */
  const APP_PATHS = ['/ask','/scripture','/auth','/me','/privacy','/copy','/dashboard']
  if (!isAppUA && APP_PATHS.some(p => path.startsWith(p))) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  /* Supabase 세션 */
  const res      = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  await supabase.auth.getSession()
  return res
}

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }
