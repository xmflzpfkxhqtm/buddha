import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateEmbeddingBatch } from '@/utils/embedding';
import { saveDocumentBatch, DocumentBatch, DocumentMetadata } from '@/utils/supabase';
import { chunkText, cleanScriptureTitle } from '@/utils/chunking';
import { scriptureTitleFromRelativePath } from '@/utils/scripturePaths';
import { supabase } from '@/utils/supabase';
import {
  isScriptureDataFile,
  listScriptureDataFilesRecursive,
  buildCanonicalTitleKeysForEmbed,
  collectChangedScriptureFiles,
} from '@/lib/scriptureFiles';

// 배치 사이즈 (한 번에 처리할 최대 청크 수)
const BATCH_SIZE = 30;
const EMBEDDING_MAX_RETRIES = 6;
const INTER_BATCH_DELAY_MS = 450;

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

interface RebuildOptions {
  fullRebuild: boolean;
  changedOnly: boolean;
  missingOnly: boolean;
}

/**
 * 배치를 처리하고 임베딩한 후 저장 (재시도 메커니즘 추가)
 */
async function processBatch(batch: ProcessedChunk[]): Promise<number> {
  if (batch.length === 0) return 0;

  // 배치에서 중복되지 않은 청크만 필터링
  const validChunks = batch.filter(item => !item.exists);
  
  if (validChunks.length === 0) return 0;
  
  const textsToEmbed = validChunks.map(item => item.chunk.text);
  const embeddings = await generateEmbeddingBatchWithRetry(textsToEmbed);

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
  
  const maxRetries = 3;
  let retryCount = 0;
  let success = false;

  while (retryCount < maxRetries && !success) {
    try {
      await saveDocumentBatch(documents);
      success = true;
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        const waitTime = retryCount * 2000;
        console.warn(`문서 저장 실패, ${retryCount}번째 재시도 (${waitTime}ms 후)...`, error);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`저장 실패 (최대 재시도 초과):`, error);
        throw error;
      }
    }
  }
  
  return validChunks.length;
}

function getRetryDelayMs(attempt: number): number {
  const base = Math.min(500 * 2 ** (attempt - 1), 10000);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return msg.includes('429') || msg.toLowerCase().includes('rate limit');
}

async function generateEmbeddingBatchWithRetry(texts: string[]): Promise<number[][]> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= EMBEDDING_MAX_RETRIES; attempt += 1) {
    try {
      return await generateEmbeddingBatch(texts);
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === EMBEDDING_MAX_RETRIES) {
        throw error;
      }
      const delayMs = getRetryDelayMs(attempt);
      console.warn(`임베딩 레이트리밋 발생, ${delayMs}ms 후 재시도 (${attempt}/${EMBEDDING_MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function isFileAlreadyProcessed(fileName: string, prevNames: Set<string>): Promise<boolean> {
  const cleanedName = cleanScriptureTitle(scriptureTitleFromRelativePath(fileName));
  if (prevNames.has(cleanedName)) return true;
  try {
    return await checkSourceExists(cleanedName);
  } catch (error) {
    console.error(`파일 처리 확인 오류: ${fileName}`, error);
    return false;
  }
}

async function checkSourceExists(sourceName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, metadata')
      .eq('metadata->>source', sourceName)
      .limit(5);
    if (error) {
      console.error('소스 확인 오류:', error);
      throw error;
    }
    return !!(data && data.length > 0);
  } catch (error) {
    console.error('소스 확인 오류 상세:', error);
    return false;
  }
}

function isTruthy(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
}

function getRebuildOptions(request: Request): RebuildOptions {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode')?.trim().toLowerCase();
  const changedOnly = isTruthy(url.searchParams.get('changed_only')) || mode === 'changed_only';
  const missingOnly = isTruthy(url.searchParams.get('missing_only')) || mode === 'missing_only';
  // missing_only 우선: full_rebuild 의 truncate 동작을 자동으로 비활성화한다.
  const fullRebuild = isTruthy(url.searchParams.get('full_rebuild')) && !missingOnly;
  return { fullRebuild, changedOnly, missingOnly };
}

async function loadAllDocumentHashes(): Promise<Set<string>> {
  const set = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('hash')
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('hash 로드 실패:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ hash: string | null }>) {
      if (row.hash) set.add(row.hash);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set;
}

async function clearTableBatch(
  source?: string,
  batchSize: number = 500,
): Promise<number> {
  let deleted = 0;
  const label = source ? `source(${source})` : 'documents';
  while (true) {
    let query = supabase.from(TABLE_NAME).select('id').limit(batchSize);
    if (source) query = query.eq('metadata->>source', source);

    const { data: ids, error: idError } = await query;
    if (idError) {
      console.error(`${label} 삭제 대상 조회 실패:`, idError);
      throw idError;
    }
    if (!ids || ids.length === 0) break;

    const deleteIds = ids.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .in('id', deleteIds);

    if (deleteError) {
      console.error(`${label} 배치 삭제 실패:`, deleteError);
      throw deleteError;
    }
    deleted += deleteIds.length;
  }
  return deleted;
}

async function clearDocumentsTable(): Promise<number> {
  return clearTableBatch(undefined, 1000);
}

async function clearSourceDocuments(sourceName: string): Promise<number> {
  return clearTableBatch(sourceName, 500);
}

export async function GET(request: Request) {
  try {
    const options = getRebuildOptions(request);
    const dataDir = path.join(process.cwd(), 'data', 'scripture');

    // 기존 처리된 데이터 폴더 (중복 확인용)
    const prevFileNames = buildCanonicalTitleKeysForEmbed();

    let deletedRows = 0;
    if (options.fullRebuild) {
      deletedRows = await clearDocumentsTable();
      console.log(`full_rebuild: documents ${deletedRows}건 삭제 완료`);
    }

    let existingHashes: Set<string> | null = null;
    if (options.missingOnly) {
      existingHashes = await loadAllDocumentHashes();
      console.log(`missing_only: 기존 hash ${existingHashes.size}개 로드`);
    }

    const files = listScriptureDataFilesRecursive(dataDir);
    let textFiles = files.filter(isScriptureDataFile);
    if (options.changedOnly) {
      textFiles = collectChangedScriptureFiles(dataDir);
      console.log(`changed_only: 대상 파일 ${textFiles.length}개`);
    }

    if (textFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 변경 source가 없습니다.',
        fullRebuild: options.fullRebuild,
        changedOnly: options.changedOnly,
        missingOnly: options.missingOnly,
        deletedRows,
        processedSources: [],
        files: [],
      });
    }
    // 파일 목록을 역순으로 정렬 (뒤에서부터 처리)
    textFiles.reverse();
    console.log(`대상 파일 ${textFiles.length}개 처리 시작`);

    // 처리 상태 추적
    const processedFiles: FileProcessResult[] = [];
    let totalChunks = 0;
    let skippedChunks = 0;
    let processedChunks = 0;
    let skippedFiles = 0;
    const processedSources: string[] = [];
    const sourceDeletedRows: Record<string, number> = {};
    
    // 각 파일 처리
    for (const file of textFiles) {
      const sourceName = cleanScriptureTitle(scriptureTitleFromRelativePath(file));

      if (options.changedOnly) {
        const deletedForSource = await clearSourceDocuments(sourceName);
        deletedRows += deletedForSource;
        sourceDeletedRows[sourceName] = deletedForSource;
        processedSources.push(sourceName);
      }

      const fileAlreadyProcessed = (options.fullRebuild || options.changedOnly || options.missingOnly)
        ? false
        : await isFileAlreadyProcessed(file, prevFileNames);
      if (fileAlreadyProcessed) {
        skippedFiles++;
        processedFiles.push({ fileName: file, totalChunks: 0, processedChunks: 0, skippedChunks: 0 });
        continue;
      }

      const filePath = path.join(dataDir, ...file.split('/'));
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileSize = fs.statSync(filePath).size;
      const chunks = chunkText(content, file);

      let chunksToProcess = chunks;
      let preSkipped = 0;
      if (options.missingOnly && existingHashes) {
        const filtered: typeof chunks = [];
        for (const c of chunks) {
          if (c.metadata.hash && existingHashes.has(c.metadata.hash)) preSkipped++;
          else filtered.push(c);
        }
        chunksToProcess = filtered;
        if (chunksToProcess.length === 0) {
          skippedFiles++;
          totalChunks += chunks.length;
          skippedChunks += preSkipped;
          processedFiles.push({ fileName: file, totalChunks: chunks.length, processedChunks: 0, skippedChunks: preSkipped });
          continue;
        }
      }
      console.log(`[${file}] ${Math.round(fileSize / 1024)}KB → 청크 ${chunks.length}개 (처리 ${chunksToProcess.length}, skip ${preSkipped})`);

      // 파일별 처리 상태
      let fileProcessedChunks = 0;

      // 배치 처리를 위한 배열
      let currentBatch: ProcessedChunk[] = [];

      // 배치 처리
      for (let i = 0; i < chunksToProcess.length; i++) {
        const chunk = chunksToProcess[i];

        // 해시가 없으면 건너뜀
        if (!chunk.metadata.hash) {
          console.warn(`해시가 없는 청크 발견: ${chunk.text.substring(0, 50)}...`);
          continue;
        }

        // 이 파일 청크는 중복 검사를 건너뛰고 바로 처리 (파일 레벨에서 이미 중복 검사함)
        currentBatch.push({
          chunk: {
            text: chunk.text,
            metadata: {
              ...chunk.metadata,
              fileSize,
              processedAt: new Date().toISOString(),
              chunkSize: chunk.text.length,
            },
          },
          exists: false,
        });

        if (currentBatch.length >= BATCH_SIZE || i === chunksToProcess.length - 1) {
          const processed = await processBatch(currentBatch);
          fileProcessedChunks += processed;
          // 새로 들어간 hash 를 existingHashes 에 반영해 다음 파일에서 cross-file 중복 자동 skip
          if (existingHashes) {
            for (const item of currentBatch) {
              if (item.chunk.metadata.hash) existingHashes.add(item.chunk.metadata.hash as string);
            }
          }
          currentBatch = [];
          await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
        }
      }

      // 파일 처리 결과 기록
      totalChunks += chunks.length;
      skippedChunks += preSkipped;
      processedChunks += fileProcessedChunks;

      processedFiles.push({
        fileName: file,
        totalChunks: chunks.length,
        processedChunks: fileProcessedChunks,
        skippedChunks: preSkipped,
      });

    }

    console.log(`완료 — 파일 ${processedFiles.length}개, 청크 처리 ${processedChunks}/${totalChunks}개, skip ${skippedChunks}개, 건너뛴 파일 ${skippedFiles}개`);
    
    return NextResponse.json({
      success: true,
      message: `${processedFiles.length}개의 파일이 성공적으로 처리되었습니다. 총 ${totalChunks}개의 청크 중 ${processedChunks}개 생성, ${skippedChunks}개 중복 건너뜀. 건너뛴 전체 파일: ${skippedFiles}개`,
      missingOnly: options.missingOnly,
      fullRebuild: options.fullRebuild,
      changedOnly: options.changedOnly,
      deletedRows,
      processedSources,
      sourceDeletedRows,
      files: processedFiles,
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