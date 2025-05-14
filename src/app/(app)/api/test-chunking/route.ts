import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { chunkText } from '@/utils/chunking';
import { generateEmbedding, generateEmbeddingBatch } from '@/utils/upstage';

export async function GET() {
  try {
    console.log('===== 한자 포함 여부에 따른 임베딩 테스트 =====');
    
    // 1. 한글만 있는 텍스트와 한자가 포함된 텍스트 준비
    const koreanOnlyText = "이것은 한자가 없는 순수한 한글 텍스트입니다. 불교 경전의 내용을 담고 있습니다.";
    const textWithHanja = "經律異相에서 발췌한 내용입니다. 부처님의 가르침을 담고 있습니다.";
    
    console.log('한글만 있는 텍스트:', koreanOnlyText);
    console.log('한자 포함 텍스트:', textWithHanja);
    
    // 결과를 저장할 변수들
    let koreanEmbedding: number[] = [];
    let hanjaEmbedding: number[] = [];
    let batchEmbeddings: number[][] = [];
    let textArray: string[] = [];
    
    // 2. 각각 임베딩 생성
    try {
      console.log('\n----- 개별 텍스트 임베딩 테스트 -----');
      
      console.log('한글만 있는 텍스트 임베딩 시도...');
      koreanEmbedding = await generateEmbedding(koreanOnlyText);
      console.log('한글만 있는 텍스트 임베딩 성공!');
      console.log('임베딩 차원:', koreanEmbedding.length);
      console.log('임베딩 샘플:', koreanEmbedding.slice(0, 5));
      console.log('0이 아닌 값 포함:', koreanEmbedding.some((val: number) => val !== 0));
      
      console.log('\n한자 포함 텍스트 임베딩 시도...');
      hanjaEmbedding = await generateEmbedding(textWithHanja);
      console.log('한자 포함 텍스트 임베딩 성공!');
      console.log('임베딩 차원:', hanjaEmbedding.length);
      console.log('임베딩 샘플:', hanjaEmbedding.slice(0, 5));
      console.log('0이 아닌 값 포함:', hanjaEmbedding.some((val: number) => val !== 0));
      
      // 3. 배치 처리 테스트
      console.log('\n----- 배치 임베딩 테스트 -----');
      textArray = [koreanOnlyText, textWithHanja];
      console.log('배치 임베딩 시도...');
      batchEmbeddings = await generateEmbeddingBatch(textArray);
      console.log('배치 임베딩 성공!');
      
      batchEmbeddings.forEach((emb: number[], i: number) => {
        console.log(`텍스트 #${i} 임베딩 차원:`, emb.length);
        console.log(`텍스트 #${i} 임베딩 샘플:`, emb.slice(0, 5));
        console.log(`텍스트 #${i} 0이 아닌 값 포함:`, emb.some((val: number) => val !== 0));
      });
    } catch (embeddingError) {
      console.error('임베딩 테스트 오류:', embeddingError);
      return NextResponse.json(
        { 
          success: false, 
          message: '임베딩 테스트 중 오류가 발생했습니다.',
          error: embeddingError instanceof Error ? embeddingError.message : '알 수 없는 오류'
        },
        { status: 500 }
      );
    }
    
    // 4. 경전 파일 테스트 (기존 코드)
    console.log('\n===== 경전 파일 임베딩 테스트 =====');
    // 1. 경율이상 경전 파일 읽기
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, '경율이상_GPT4.1번역.txt');
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf-8');
      console.log(`파일 읽기 성공: ${filePath}`);
      console.log(`파일 크기: ${fileContent.length} 바이트`);
      console.log(`파일 내용 처음 100자: ${fileContent.substring(0, 100)}`);
    } catch (err) {
      console.error(`파일 읽기 오류: ${err}`);
      return NextResponse.json(
        { success: false, message: '경전 파일을 읽을 수 없습니다.' },
        { status: 500 }
      );
    }
    
    // 2. 청킹 수행
    console.log('청킹 시작...');
    const chunks = chunkText(fileContent, '경율이상_GPT4.1번역.txt');
    console.log(`청킹 완료. 총 ${chunks.length}개의 청크가 생성되었습니다.`);
    
    // 청크 샘플 확인
    const chunkSamples = chunks.slice(0, 3).map((chunk, i) => ({
      index: i,
      text: chunk.text.substring(0, 100) + '...',
      length: chunk.text.length,
      metadata: chunk.metadata
    }));
    
    console.log('청크 샘플:', JSON.stringify(chunkSamples, null, 2));
    
    // 3. 임베딩 생성 (첫 3개 청크만)
    console.log('임베딩 생성 시작...');
    const testChunks = chunks.slice(0, 3);
    
    try {
      const embeddings = await generateEmbeddingBatch(testChunks.map(c => c.text));
      console.log(`임베딩 생성 완료. ${embeddings.length}개의 임베딩이 생성되었습니다.`);
      
      // 임베딩 정보 확인
      embeddings.forEach((embedding, i) => {
        console.log(`임베딩 #${i} 차원: ${embedding.length}`);
        console.log(`임베딩 #${i} 샘플: ${embedding.slice(0, 5)}`);
        console.log(`임베딩 #${i} L2 norm: ${Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))}`);
        console.log(`임베딩 #${i} 0이 아닌 값: ${embedding.some(val => val !== 0)}`);
      });
      
      return NextResponse.json({
        success: true,
        koreanOnlyTest: {
          text: koreanOnlyText,
          hasNonZeroValues: koreanEmbedding.some((val: number) => val !== 0)
        },
        hanjaTest: {
          text: textWithHanja,
          hasNonZeroValues: hanjaEmbedding.some((val: number) => val !== 0)
        },
        batchTest: {
          texts: textArray,
          results: batchEmbeddings.map((emb: number[], i: number) => ({
            index: i,
            hasNonZeroValues: emb.some((val: number) => val !== 0)
          }))
        },
        fileTest: {
          totalChunks: chunks.length,
          testedChunks: testChunks.length,
          chunkSamples,
          embeddingInfo: embeddings.map((emb, i) => ({
            index: i,
            dimensions: emb.length,
            sample: emb.slice(0, 5),
            hasNonZeroValues: emb.some(val => val !== 0)
          }))
        }
      });
    } catch (embeddingError) {
      console.error('임베딩 생성 오류:', embeddingError);
      return NextResponse.json(
        { 
          success: false, 
          message: '임베딩 생성 중 오류가 발생했습니다.',
          error: embeddingError instanceof Error ? embeddingError.message : '알 수 없는 오류',
          totalChunks: chunks.length,
          chunkSamples
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('테스트 실행 중 오류 발생:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '테스트 실행 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
} 