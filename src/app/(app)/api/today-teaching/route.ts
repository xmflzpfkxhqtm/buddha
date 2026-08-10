// app/api/today-teaching/route.ts

import { NextResponse } from 'next/server';
import { todayTeaching } from '@/lib/todayTeaching';

export async function GET() {
  const today = new Date();
  const index = today.getDate() % todayTeaching.length;
  const teaching = todayTeaching[index];

  // 오늘 자정까지 캐시 (날짜 기반 콘텐츠)
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const secondsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  return NextResponse.json(teaching, {
    headers: {
      'Cache-Control': `public, s-maxage=${secondsUntilMidnight}, stale-while-revalidate=3600`,
    },
  });
}
