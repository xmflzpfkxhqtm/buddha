import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { saveDocumentBatch, DocumentBatch, DocumentMetadata } from '@/utils/supabase';
import { chunkText, cleanScriptureTitle } from '@/utils/chunking';
import { supabase } from '@/utils/supabase';

// 배치 사이즈 (한 번에 처리할 최대 청크 수)
const BATCH_SIZE = 30;

// Supabase 테이블 이름
const TABLE_NAME = 'documents';

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
  
  
  console.log(`[테스트 모드] 임베딩 및 저장 생략 - ${validChunks.length}개 청크 처리된 것으로 간주`);
  
  return validChunks.length;
}

/**
 * 파일이 이미 처리되었는지 확인
 */
async function isFileAlreadyProcessed(fileName: string, prevNames: Set<string>): Promise<boolean> {
  // 파일명에서 확장자 제거 및 정리
  const baseName = fileName.replace(/\.txt$/, '');
  const cleanedName = cleanScriptureTitle(baseName);
  
  console.log(`파일 중복 확인 중: ${fileName} (정리된 이름: ${cleanedName})`);
  
  // 이미 prevFileNames에서 확인한 경우 중복 확인
  if (prevNames.has(cleanedName)) {
    console.log(`중복 확인: ${cleanedName} - 기존 데이터 폴더에 존재함`);
    return true;
  }
  
  try {
    // Supabase에서 해당 소스명으로 문서 존재하는지 확인
    console.log(`Supabase에서 소스 '${cleanedName}' 확인 중...`);
    
    // 데이터베이스에서 확인 (해당 소스의 첫 번째 청크가 있는지)
    const exists = await checkSourceExists(cleanedName);
    return exists;
  } catch (error) {
    console.error(`파일 처리 확인 오류: ${fileName}`, error);
    return false; // 오류 발생 시 처리 진행
  }
}

/**
 * 소스 이름으로 문서 존재 여부 확인
 */
async function checkSourceExists(sourceName: string): Promise<boolean> {
  try {
    console.log(`소스 '${sourceName}' 문서 검색 중...`);
    
    // JSONB 쿼리 구문 수정 - 올바른 문법으로 변경
    console.log(`실행 쿼리: SELECT id, metadata FROM ${TABLE_NAME} WHERE metadata->>'source' = '${sourceName}' LIMIT 5`);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, metadata')
      .eq('metadata->>source', sourceName)  // 올바른 JSONB 경로 표현식
      .limit(5);

    if (error) {
      console.error('소스 확인 오류:', error);
      throw error;
    }
    
    console.log('조회 결과:', JSON.stringify(data, null, 2));
    
    // 일치하는 항목 찾기
    const exists = data && data.length > 0;
    console.log(`소스 '${sourceName}' 확인 최종 결과: ${exists ? '존재함' : '존재하지 않음'}`);
    return exists;
  } catch (error) {
    console.error('소스 확인 오류 상세:', error);
    return false;
  }
}

export async function GET() {
  try {
    console.log('========== 임베딩 처리 시작 ==========');
    
    // 데이터 폴더의 경로 (scripture 폴더 사용)
    const dataDir = path.join(process.cwd(), 'data', 'scripture');
    console.log(`데이터 폴더: ${dataDir}`);
    
    // 기존 처리된 데이터 폴더 (중복 확인용)
    const prevDataDir = path.join(process.cwd(), 'data');
    const prevFiles = fs.existsSync(prevDataDir) ? fs.readdirSync(prevDataDir) : [];
    // 파일명에서 _GPT4.1번역 등을 제거한 파일명 세트 생성
    const prevFileNames = new Set(prevFiles
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        // 접미사 제거 및 확장자 제외하고 기본 이름만 저장
        const baseName = file.replace(/\.txt$/, '');
        return cleanScriptureTitle(baseName);
      }));
    console.log(`기존 처리된 파일 수: ${prevFileNames.size}개`);
    
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
    let skippedFiles = 0;
    
    // 각 파일 처리
    for (const file of textFiles) {
      console.log(`\n===== 파일 처리 시작: ${file} =====`);
      
      // 파일 단위로 먼저 중복 확인
      const fileAlreadyProcessed = await isFileAlreadyProcessed(file, prevFileNames);
      if (fileAlreadyProcessed) {
        console.log(`이미 처리된 파일 건너뛰기: ${file}`);
        skippedFiles++;
        
        // 처리 결과 기록
        processedFiles.push({
          fileName: file,
          totalChunks: 0,
          processedChunks: 0,
          skippedChunks: 0
        });
        
        continue; // 다음 파일로 넘어감
      }
      
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
      const fileSkippedChunks = 0;
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
        
        // 이 파일 청크는 중복 검사를 건너뛰고 바로 처리 (파일 레벨에서 이미 중복 검사함)
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
          exists: false  // 항상 false로 설정하여 모든 청크 처리
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
    console.log(`건너뛴 전체 파일: ${skippedFiles}개`);
    
    return NextResponse.json({
      success: true,
      message: `${processedFiles.length}개의 파일이 성공적으로 처리되었습니다. 총 ${totalChunks}개의 청크 중 ${processedChunks}개 생성, ${skippedChunks}개 중복 건너뜀. 건너뛴 전체 파일: ${skippedFiles}개`,
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