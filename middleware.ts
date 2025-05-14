// middleware.ts (루트)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const APP_HEADER = 'x-yeondeung-app'          // ① WebView가 무조건 보내는 커스텀 헤더
const APP_UA_TAG = 'yeondeungapp'             // ② 예비 플래그

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ua  = req.headers.get('user-agent')?.toLowerCase() ?? ''
  const hdr = req.headers.get(APP_HEADER) === 'true'

  const isApp = hdr || ua.includes(APP_UA_TAG)

  // 브라우저가 내부 경로 직접 호출 → 루트로
  const APP_ONLY = ['/ask','/scripture','/me','/dashboard']
  if (!isApp && APP_ONLY.some(p => pathname.startsWith(p))) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next|.*\\..*).*)'] }
