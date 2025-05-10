import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 값을 가져오거나 기본값 사용
//xmflzpfkxhqtm's Project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
}

// 문서 메타데이터 인터페이스
export interface DocumentMetadata {
  fileName?: string;
  fileSize?: number;
  processedAt?: string;
  source?: string;
  hash?: string; // 중복 확인용 해시
  [key: string]: unknown;
}

// 검색 결과 인터페이스
export interface DocumentResult {
  id: number | string;  // bigint 타입 지원을 위해 변경
  content: string;
  metadata: DocumentMetadata;
  similarity: number;
}

// 배치 저장용 인터페이스
export interface DocumentBatch {
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
}

// Supabase 클라이언트 생성 (적절한 옵션 설정)
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  }
});

// 테이블 이름 - public 스키마의 뷰 사용 (실제로는 buddha.documents를 가리킴)
const TABLE_NAME = 'documents';

/**
 * 문서 데이터와 임베딩을 저장
 */
export async function saveDocument(content: string, embedding: number[], metadata?: DocumentMetadata) {
  try {
    // 테이블 이름에 스키마를 명시적으로 포함
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert({
        content,
        embedding,
        metadata,
      });

    if (error) {
      console.error('문서 저장 오류:', error);
      throw error;
    }
    return true;
  } catch (error) {
    console.error('문서 저장 오류 상세:', error);
    throw new Error('문서 저장 중 오류가 발생했습니다.');
  }
}

/**
 * 여러 문서와 임베딩을 배치로 저장
 */
export async function saveDocumentBatch(documents: DocumentBatch[]) {
  if (documents.length === 0) return { inserted: 0 };
  
  try {
    // 테이블 이름에 스키마를 명시적으로 포함
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert(documents.map(doc => ({
        content: doc.content,
        embedding: doc.embedding,
        metadata: doc.metadata
      })));

    if (error) {
      console.error('Supabase 저장 오류 상세:', error);
      throw error;
    }
    return { inserted: documents.length };
  } catch (error) {
    console.error('배치 문서 저장 오류 상세:', error);
    throw new Error('배치 문서 저장 중 오류가 발생했습니다.');
  }
}

/**
 * 문서 내용의 해시값으로 이미 처리된 문서인지 확인
 */
export async function checkDocumentExists(contentHash: string): Promise<boolean> {
  try {
    // 테이블 이름에 스키마를 명시적으로 포함
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('metadata->>hash', contentHash)
      .limit(1);

    if (error) {
      console.error('문서 확인 오류 상세:', error);
      throw error;
    }
    return data && data.length > 0;
  } catch (error) {
    console.error('문서 확인 오류 상세:', error);
    return false; // 오류가 발생하면 중복이 아닌 것으로 간주
  }
}

/**
 * 임베딩 벡터를 사용하여 유사한 문서 검색
 */
export async function searchSimilarDocuments(embedding: number[], limit: number = 5): Promise<DocumentResult[]> {
  try {
    const { data, error } = await supabase
      .rpc('match_documents', {
        query_embedding: embedding,
        match_count: limit
      });

    if (error) {
      console.error('문서 검색 오류 상세:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('문서 검색 오류 상세:', error);
    throw new Error('문서 검색 중 오류가 발생했습니다.');
  }
}

/**
 * halfvec 인덱스를 사용하여 유사한 문서 검색 (최적화 버전)
 */
export async function searchSimilarDocumentsOptimized(embedding: number[], limit: number = 5): Promise<DocumentResult[]> {
  try {
    // 벡터를 halfvec으로 변환하기 위해 직접 SQL 쿼리 실행
    const { data, error } = await supabase.rpc('match_documents_optimized', {
      query_embedding: embedding,
      match_count: limit
    });

    if (error) {
      console.error('최적화 문서 검색 오류 상세:', error);
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('최적화 문서 검색 오류 상세:', error);
    throw new Error('최적화 문서 검색 중 오류가 발생했습니다.');
  }
} 