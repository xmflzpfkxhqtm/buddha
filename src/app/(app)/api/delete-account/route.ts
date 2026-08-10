import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ message: 'userId가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('계정 삭제 실패:', error);
      return NextResponse.json({ message: '삭제 실패', error }, { status: 500 });
    }

    return NextResponse.json({ message: '계정이 삭제되었습니다.' });
  } catch (err) {
    console.error('delete-account 오류:', err);
    return NextResponse.json({ message: '서버 오류' }, { status: 500 });
  }
}
