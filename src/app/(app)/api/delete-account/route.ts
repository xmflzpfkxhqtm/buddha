import { NextRequest, NextResponse } from 'next/server';
import { bearerToken } from '@/lib/requestUser';

// 탈퇴는 Supabase Edge Function `delete-account`가 처리한다(Flutter 앱과 같은 경로).
// 함수가 토큰의 사용자만, 연쇄 삭제되지 않는 기록과 사경 이미지까지 지운다.
// 예전에는 본문의 userId만 믿고 지워서 남의 계정을 지울 수 있었다.
export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ message: '로그인 후 다시 시도해 주세요.' }, { status: 401 });
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('delete-account 함수 실패:', res.status, body);
      return NextResponse.json(
        { message: body?.message ?? '계정을 삭제하지 못했습니다.' },
        { status: res.status },
      );
    }
    return NextResponse.json({ message: '계정이 삭제되었습니다.' });
  } catch (err) {
    console.error('delete-account 오류:', err);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}
