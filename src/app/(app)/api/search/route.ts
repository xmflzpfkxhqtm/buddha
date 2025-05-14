import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { searchSimilarDocuments, DocumentResult } from '@/utils/supabase';

export async function POST(request: NextRequest) {
  try {
    // 요청 본문에서 검색 쿼리 추출
    const { query, limit = 5 } = await request.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, message: '검색 쿼리가 유효하지 않습니다.' },
        { status: 400 }
      );
    }
    
    // 쿼리 텍스트에 대한 임베딩 생성 (배치 처리 API 사용)
    const [embedding] = await generateEmbeddingBatch([query]);
    
    // 임베딩을 사용하여 유사한 문서 검색
    const results: DocumentResult[] = await searchSimilarDocuments(embedding, limit);
    
    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('검색 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 