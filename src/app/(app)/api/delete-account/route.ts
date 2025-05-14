import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const { userId } = body;
  
      if (!userId) {
        return NextResponse.json({ message: 'userId가 필요합니다.' }, { status: 400 });
      }
  
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
  
      console.log('삭제할 사용자 ID:', userId); // 사용자 ID 출력
  
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  
      if (error) {
        console.error('삭제 실패:', error);  // 실패 시의 세부 오류 로그 출력
        return NextResponse.json({ message: '❌ 삭제 실패', error }, { status: 500 });
      }
  
      return NextResponse.json({ message: '✅ 계정이 삭제되었습니다.' });
    } catch (err) {
      console.error('서버 오류:', err);  // 전체 오류 로그 출력
      return NextResponse.json({ message: '❌ 서버 오류' }, { status: 500 });
    }
  }
    