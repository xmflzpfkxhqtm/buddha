// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession(); // ✅ 필수
  return res;
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'], // 정적 파일 제외한 모든 요청에 적용
};
