import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { saveDocumentBatch, DocumentBatch, checkDocumentExists, DocumentMetadata } from '@/utils/supabase';
import { chunkText, cleanScriptureTitle } from '@/utils/chunking';

// 배치 사이즈 (한 번에 처리할 최대 청크 수)
const BATCH_SIZE = 30;

interface ProcessedChunk {
  chunk: {
    text: string;
    metadata: DocumentMetadata;
  };
  exists: boolean;
}

interface FileProcessResult {
  fileName: string;
  totalChunks: number;
  processedChunks: number;
  skippedChunks: number;
}

/**
 * 배치를 처리하고 임베딩한 후 저장
 */
async function processBatch(batch: ProcessedChunk[]): Promise<number> {
  if (batch.length === 0) return 0;

  // 배치에서 중복되지 않은 청크만 필터링
  const validChunks = batch.filter(item => !item.exists);
  
  if (validChunks.length === 0) return 0;
  
  console.log(`배치 처리 시작: ${validChunks.length}개의 청크 처리 중...`);
  
  // 배치 임베딩 생성
  const textsToEmbed = validChunks.map(item => item.chunk.text);
  console.log(`임베딩 생성 요청: ${textsToEmbed.length}개의 텍스트`);
  
  const startTime = Date.now();
  const embeddings = await generateEmbeddingBatch(textsToEmbed);
  const endTime = Date.now();
  
  console.log(`임베딩 생성 완료: ${embeddings.length}개 생성됨 (${endTime - startTime}ms 소요)`);
  
  // 배치 저장을 위한 문서 배열 생성
  const documents: DocumentBatch[] = validChunks.map((item, index) => {
    // 소스 이름에서 _GPT4.1번역 등을 제거
    const cleanedSource = item.chunk.metadata.source 
      ? cleanScriptureTitle(item.chunk.metadata.source as string)
      : undefined;

    return {
      content: item.chunk.text,
      embedding: embeddings[index],
      metadata: {
        ...item.chunk.metadata,
        source: cleanedSource
      }
    };
  });
  
  // 배치 저장
  console.log(`Supabase에 ${documents.length}개의 문서 저장 중...`);
  const saveStartTime = Date.now();
  await saveDocumentBatch(documents);
  const saveEndTime = Date.now();
  console.log(`문서 저장 완료 (${saveEndTime - saveStartTime}ms 소요)`);
  
  return validChunks.length;
}

export async function GET() {
  try {
    console.log('========== 임베딩 처리 시작 ==========');
    
    // 데이터 폴더의 경로
    const dataDir = path.join(process.cwd(), 'data');
    console.log(`데이터 폴더: ${dataDir}`);
    
    // 데이터 폴더의 모든 파일 읽기
    const files = fs.readdirSync(dataDir);
    console.log(`총 파일 수: ${files.length}개`);
    
    // .txt 파일만 필터링
    const textFiles = files.filter(file => file.endsWith('.txt'));
    console.log(`텍스트 파일 수: ${textFiles.length}개`);
    
    // 처리 상태 추적
    const processedFiles: FileProcessResult[] = [];
    let totalChunks = 0;
    let skippedChunks = 0;
    let processedChunks = 0;
    
    // 각 파일 처리
    for (const file of textFiles) {
      console.log(`\n===== 파일 처리 시작: ${file} =====`);
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileSize = fs.statSync(filePath).size;
      console.log(`파일 크기: ${Math.round(fileSize / 1024)}KB, 문자 수: ${content.length}`);
      
      // 텍스트를 청크로 분할
      console.log('청크 분할 중...');
      const chunks = chunkText(content, file);
      console.log(`청크 분할 완료: ${chunks.length}개 생성됨`);
      
      // 청크 길이 통계
      const chunkLengths = chunks.map(chunk => chunk.text.length);
      const avgChunkLength = chunkLengths.reduce((sum, length) => sum + length, 0) / chunkLengths.length;
      const minChunkLength = Math.min(...chunkLengths);
      const maxChunkLength = Math.max(...chunkLengths);
      console.log(`청크 길이 통계 - 평균: ${Math.round(avgChunkLength)}, 최소: ${minChunkLength}, 최대: ${maxChunkLength}`);
      
      // 파일별 처리 상태
      let fileSkippedChunks = 0;
      let fileProcessedChunks = 0;
      
      // 배치 처리를 위한 배열
      let currentBatch: ProcessedChunk[] = [];
      let batchCount = 0;
      
      // 배치 처리
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 해시가 없으면 건너뜀
        if (!chunk.metadata.hash) {
          console.warn(`해시가 없는 청크 발견: ${chunk.text.substring(0, 50)}...`);
          continue;
        }
        
        // 먼저 중복 확인
        const exists = await checkDocumentExists(chunk.metadata.hash);
        
        if (exists) {
          fileSkippedChunks++;
          if (fileSkippedChunks % 10 === 0) {
            console.log(`중복 건너뛰기: ${fileSkippedChunks}개`);
          }
          continue; // 이미 존재하는 청크는 건너뜀
        }
        
        // 현재 배치에 추가
        currentBatch.push({ 
          chunk: {
            text: chunk.text,
            metadata: {
              ...chunk.metadata,
              fileSize,
              processedAt: new Date().toISOString(),
              chunkSize: chunk.text.length
            }
          }, 
          exists: false 
        });
        
        // 배치가 가득 찼거나 마지막 청크인 경우 처리
        if (currentBatch.length >= BATCH_SIZE || i === chunks.length - 1) {
          batchCount++;
          console.log(`배치 #${batchCount} 처리 중 (${currentBatch.length}개 청크)`);
          const processed = await processBatch(currentBatch);
          fileProcessedChunks += processed;
          console.log(`배치 처리 완료: ${processed}개 처리됨, 누적 ${fileProcessedChunks}개`);
          currentBatch = []; // 배치 초기화
        }
      }
      
      // 파일 처리 결과 기록
      totalChunks += chunks.length;
      skippedChunks += fileSkippedChunks;
      processedChunks += fileProcessedChunks;
      
      processedFiles.push({
        fileName: file,
        totalChunks: chunks.length,
        processedChunks: fileProcessedChunks,
        skippedChunks: fileSkippedChunks
      });
      
      console.log(`===== 파일 처리 완료: ${file} =====`);
      console.log(`총 청크: ${chunks.length}개, 처리됨: ${fileProcessedChunks}개, 건너뜀: ${fileSkippedChunks}개`);
    }
    
    console.log('\n========== 임베딩 처리 종료 ==========');
    console.log(`총 파일: ${processedFiles.length}개`);
    console.log(`총 청크: ${totalChunks}개, 처리됨: ${processedChunks}개, 건너뜀: ${skippedChunks}개`);
    
    return NextResponse.json({
      success: true,
      message: `${processedFiles.length}개의 파일이 성공적으로 처리되었습니다. 총 ${totalChunks}개의 청크 중 ${processedChunks}개 생성, ${skippedChunks}개 중복 건너뜀.`,
      files: processedFiles
    });
  } catch (error) {
    console.error('임베딩 처리 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '임베딩 생성 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 