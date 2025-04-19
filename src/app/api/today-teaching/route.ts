// app/api/today-teaching/route.ts

import { NextResponse } from 'next/server';
import { todayTeaching } from '@/lib/todayTeaching';

export async function GET() {
  const today = new Date();
  const index = today.getDate() % todayTeaching.length;
  const teaching = todayTeaching[index];

  return NextResponse.json(teaching);
}
