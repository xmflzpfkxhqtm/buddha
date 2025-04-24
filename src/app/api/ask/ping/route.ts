// ✅ 완성된 버전
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'awake' });
}
