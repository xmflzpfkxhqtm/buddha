export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { searchSimilarDocuments } from '@/utils/supabase';

// 재시도 설정
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// 타임아웃 설정으로 비동기 함수 실행
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operationName} 작업 타임아웃 (${timeoutMs}ms)`)), timeoutMs)
    )
  ]);
}

// 재시도 로직을 포함한 함수 실행
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number, delayMs: number, operationName: string): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ ${operationName} 실패 (시도 ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        console.log(`🔄 ${delayMs}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`${operationName} 실패: 최대 재시도 횟수(${maxRetries}회) 초과. 마지막 오류: ${lastError}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || '평온한 마음을 가지려면 어떻게 해야 하나요?';
    const startTime = Date.now();

    console.log('📊 웜업 API 호출됨:', { query });

    // 임베딩 생성 - 재시도 및 타임아웃 적용
    const embedding = await withRetry(
      async () => {
        const [result] = await withTimeout(
          generateEmbeddingBatch([query]), 
          15000, // 15초 타임아웃
          '임베딩 생성'
        );
        return result;
      },
      MAX_RETRIES,
      RETRY_DELAY,
      '임베딩 생성'
    );
    
    console.log('✅ 임베딩 생성 완료');

    // 벡터 검색 - 재시도 및 타임아웃 적용
    const documents = await withRetry(
      async () => withTimeout(
        searchSimilarDocuments(embedding, 5),
        10000, // 10초 타임아웃
        '벡터 검색'
      ),
      MAX_RETRIES,
      RETRY_DELAY,
      '벡터 검색'
    );
    
    console.log('✅ 벡터 검색 완료, 결과 수:', documents.length);

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    return NextResponse.json({
      success: true,
      message: '웜업 완료',
      stats: {
        elapsedTimeMs: elapsedTime,
        documentCount: documents.length,
        retrySettings: {
          maxRetries: MAX_RETRIES,
          retryDelay: RETRY_DELAY
        }
      }
    });
  } catch (error) {
    console.error('❌ 웜업 API 오류:', error);
    return NextResponse.json(
      { success: false, message: '웜업 중 오류 발생', error: String(error) },
      { status: 500 }
    );
  }
} 