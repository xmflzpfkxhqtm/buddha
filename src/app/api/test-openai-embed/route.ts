import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/utils/upstage';
import { saveDocument } from '@/utils/supabase';

export async function GET() {
  try {
    console.log('======== OpenAI 임베딩 테스트 시작 ========');
    
    // 테스트용 텍스트
    const testText = "경률이는 부처님의 가르침을 따르는 착한 사람입니다.";
    console.log(`테스트 텍스트: "${testText}"`);
    
    // 임베딩 생성
    console.log('임베딩 생성 중...');
    const startTime = Date.now();
    const embedding = await generateEmbedding(testText);
    const endTime = Date.now();
    
    console.log(`임베딩 생성 완료! (${endTime - startTime}ms 소요)`);
    console.log(`임베딩 차원: ${embedding.length}`);
    console.log(`임베딩 샘플: [${embedding.slice(0, 5).join(', ')}...]`);
    
    // Supabase에 저장
    console.log('Supabase에 저장 중...');
    const saveStartTime = Date.now();
    await saveDocument(testText, embedding, {
      source: 'test',
      hash: 'test-openai-embed-1',
      fileName: 'test.txt',
      processedAt: new Date().toISOString()
    });
    const saveEndTime = Date.now();
    
    console.log(`Supabase 저장 완료! (${saveEndTime - saveStartTime}ms 소요)`);
    
    console.log('======== OpenAI 임베딩 테스트 종료 ========');
    
    return NextResponse.json({
      success: true,
      message: '테스트 완료: OpenAI 임베딩 생성 및 Supabase 저장 성공',
      textLength: testText.length,
      embeddingDimension: embedding.length,
      embeddingSample: embedding.slice(0, 5),
      processingTimeMs: endTime - startTime,
      savingTimeMs: saveEndTime - saveStartTime
    });
  } catch (error) {
    console.error('OpenAI 임베딩 테스트 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '테스트 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 