export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // 서버 시작 시간 기록
    const startTime = Date.now();
    
    // Supabase 연결 테스트
    const { error } = await supabase
      .from('temp_answers')
      .select('id', { count: 'exact', head: true });
    
    const endTime = Date.now();
    
    return NextResponse.json({
      status: 'ok',
      message: 'API 서버 활성화 상태',
      timestamp: new Date().toISOString(),
      responseTimeMs: endTime - startTime,
      connectionOk: !error
    });
  } catch (error) {
    console.error('❌ 핑 API 오류:', error);
    return NextResponse.json(
      { status: 'error', message: '서버 오류', error: String(error) },
      { status: 500 }
    );
  }
}
