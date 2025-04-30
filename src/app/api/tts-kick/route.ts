// app/api/tts-kick/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Supabase Edge Function 호출 (인증 필요 없음 ― no-verify-jwt 로 배포했기 때문)
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tts_worker`, {
    method: 'POST',
  });

  return NextResponse.json({ ok: true });
}
