import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://api.openai.com/v1'
});

/**
 * 유효한 임베딩인지 확인
 */
function isValidEmbedding(embedding: number[]): boolean {
  // 배열이 존재하고 길이가 적절한지 확인 (최소 길이만 체크)
  const hasValidLength = embedding && embedding.length > 0;
  
  // 0 벡터인지 확인하는 대신, 단순히 유효한 배열인지 확인
  return hasValidLength;
}

/**
 * OpenAI API를 사용하여 단일 텍스트 임베딩 생성
 * @param text 임베딩할 텍스트
 * @returns 임베딩 벡터
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log('단일 임베딩 생성 중...');
    
    // API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    
    const embeddings = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
    });
    
    const embedding = embeddings.data[0].embedding;
    
    // 임베딩 유효성 검증
    if (!isValidEmbedding(embedding)) {
      throw new Error('API에서 유효하지 않은 임베딩이 반환되었습니다.');
    }
    
    return embedding;
  } catch (error) {
    console.error('텍스트 임베딩 생성 오류:', error);
    throw new Error('텍스트 임베딩 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
  }
}

/**
 * OpenAI API를 사용하여 배치로 여러 텍스트 임베딩 생성
 * @param texts 임베딩할 텍스트 배열
 * @returns 임베딩 벡터 배열
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  try {
    console.log('배치 임베딩 생성 중... 텍스트 개수:', texts.length);
    console.log('텍스트 샘플:', texts.map(t => t.substring(0, 50) + '...'));
    
    // API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
    }
    
    console.log('API 요청 전송 중...');
    // 모델 이름 변경
    const modelName = 'text-embedding-3-large';
    console.log('사용 모델:', modelName);

    const embeddings = await openai.embeddings.create({
      model: modelName,
      input: texts,
    });
    
    console.log('API 응답 받음. 임베딩 개수:', embeddings.data.length);
    console.log('API 응답 원본 데이터:', JSON.stringify(embeddings).substring(0, 200) + '...');
    console.log('데이터 타입:', typeof embeddings.data);
    console.log('첫 번째 임베딩 원본:', JSON.stringify(embeddings.data[0]).substring(0, 200) + '...');
    
    // 각 임베딩 유효성 확인
    const results = embeddings.data.map((item, index) => {
      console.log(`임베딩 #${index} 타입:`, typeof item.embedding);
      console.log(`임베딩 #${index} 길이:`, item.embedding.length);
      console.log(`임베딩 #${index} 샘플:`, item.embedding.slice(0, 5));
      
      const embedding = item.embedding;
      
      // 유효성 검사
      if (!isValidEmbedding(embedding)) {
        console.error(`임베딩 #${index} 유효하지 않음:`, 
          '0이 아닌 값 포함:', embedding.some(val => val !== 0));
        throw new Error(`텍스트 #${index}의 임베딩이 유효하지 않습니다.`);
      }
      
      return embedding;
    });
    
    return results;
  } catch (error) {
    console.error('배치 임베딩 생성 오류:', error);
    throw new Error('배치 임베딩 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
  }
} 