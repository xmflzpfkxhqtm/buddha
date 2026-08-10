import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { chunkText } from '@/utils/chunking';
import { generateEmbedding, generateEmbeddingBatch } from '@/utils/embedding';

export async function GET() {
  try {
    const koreanOnlyText = "이것은 한자가 없는 순수한 한글 텍스트입니다. 불교 경전의 내용을 담고 있습니다.";
    const textWithHanja = "經律異相에서 발췌한 내용입니다. 부처님의 가르침을 담고 있습니다.";

    let koreanEmbedding: number[] = [];
    let hanjaEmbedding: number[] = [];
    let batchEmbeddings: number[][] = [];
    let textArray: string[] = [];

    try {
      koreanEmbedding = await generateEmbedding(koreanOnlyText);
      hanjaEmbedding = await generateEmbedding(textWithHanja);
      textArray = [koreanOnlyText, textWithHanja];
      batchEmbeddings = await generateEmbeddingBatch(textArray);
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

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, '경율이상_GPT4.1번역.txt');

    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`파일 읽기 오류: ${err}`);
      return NextResponse.json(
        { success: false, message: '경전 파일을 읽을 수 없습니다.' },
        { status: 500 }
      );
    }

    const chunks = chunkText(fileContent, '경율이상_GPT4.1번역.txt');
    const chunkSamples = chunks.slice(0, 3).map((chunk, i) => ({
      index: i,
      text: chunk.text.substring(0, 100) + '...',
      length: chunk.text.length,
      metadata: chunk.metadata
    }));

    try {
      const testChunks = chunks.slice(0, 3);
      const embeddings = await generateEmbeddingBatch(testChunks.map(c => c.text));

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
