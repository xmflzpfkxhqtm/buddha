import path from 'path';
import crypto from 'crypto';
import { DocumentMetadata } from '@/utils/supabase';

/**
 * 텍스트 내용에 대한 해시값 생성
 * @param text 해시를 생성할 텍스트
 * @returns SHA-256 해시값
 */
export function generateContentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 경전 이름에서 번역 정보 등을 제거하는 함수
 * @param name 원본 경전 이름
 * @returns 정제된 경전 이름
 */
export function cleanScriptureTitle(name: string): string {
  // 디버깅용 로그 출력
  console.log('정리 전 이름:', name);
  
  // _GPT 접미사/확장자 제거 + 공백 정리
  const cleaned = name
    .replace(/_GPT.*$/, '')
    .replace(/\.(txt|md)$/i, '')
    .trim();
  
  console.log('정리 후 이름:', cleaned);
  return cleaned;
}

/**
 * Markdown 표기 제거/정규화 (RAG 임베딩 품질 개선용)
 */
function normalizeMarkdownForEmbedding(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, '$2')
    .replace(/\[\[([^[\]]+)\]\]/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * 텍스트를 문장 단위로 청킹하는 함수
 * @param text 원본 텍스트
 * @param fileName 파일 이름
 * @param chunkSize 청크 최대 크기 (기본값: 500자)
 * @param overlap 청크 간 겹치는 크기 (기본값: 50자)
 * @param maxChunkSize 최대 청크 크기 제한 (기본값: 1000자)
 * @returns 청킹된 텍스트 배열
 */
export function chunkText(
  text: string, 
  fileName: string, 
  chunkSize: number = 500, 
  overlap: number = 50,
  maxChunkSize: number = 1000
): { text: string, metadata: DocumentMetadata }[] {
  // 경전 이름 추출 (확장자/txt/md 접미사 제거)
  const scriptureTitle = cleanScriptureTitle(path.basename(fileName).replace(/\.(txt|md)$/i, ''));
  console.log(`경전 이름: ${scriptureTitle}`);

  const normalizedText = normalizeMarkdownForEmbedding(text);
  const normalizedLines = normalizedText.split('\n');
  const sentenceRegex = /[^.!?。！？]+[.!?。！？]?/g;

  type SentenceUnit = {
    text: string;
    line: number;
    sentenceIndex: number;
  };
  const sentenceUnits: SentenceUnit[] = [];
  let sentenceIndex = 0;

  normalizedLines.forEach((line, lineIdx) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    const matches = trimmedLine.match(sentenceRegex) ?? [];
    for (const m of matches) {
      const textPart = m.trim();
      if (!textPart) continue;
      sentenceUnits.push({
        text: textPart,
        line: lineIdx,
        sentenceIndex,
      });
      sentenceIndex += 1;
    }
  });

  const volumeMatch = scriptureTitle.match(/_(\d+)권$/);
  const volume = volumeMatch ? Number.parseInt(volumeMatch[1], 10) : undefined;
  
  // 청크 생성
  const chunks: { text: string, metadata: DocumentMetadata }[] = [];
  let currentChunk = '';
  let lastSentencesBuffer = '';
  let chunkLineStart = -1;
  let chunkLineEnd = -1;
  let chunkSentenceStart = -1;
  let chunkSentenceEnd = -1;

  const pushChunk = (chunkBody: string) => {
    chunks.push({
      text: chunkBody,
      metadata: {
        fileName,
        source: scriptureTitle,
        source_title: scriptureTitle,
        volume,
        line_start: chunkLineStart >= 0 ? chunkLineStart : undefined,
        line_end: chunkLineEnd >= 0 ? chunkLineEnd : undefined,
        sentence_start: chunkSentenceStart >= 0 ? chunkSentenceStart : undefined,
        sentence_end: chunkSentenceEnd >= 0 ? chunkSentenceEnd : undefined,
        hash: generateContentHash(chunkBody),
      },
    });
  };

  const resetChunkTracking = () => {
    chunkLineStart = -1;
    chunkLineEnd = -1;
    chunkSentenceStart = -1;
    chunkSentenceEnd = -1;
  };
  
  for (const sentenceUnit of sentenceUnits) {
    const sentence = sentenceUnit.text;
    // 현재 청크가 비어있으면 헤더 추가
    if (currentChunk === '') {
      currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
      resetChunkTracking();
    }
    if (chunkLineStart < 0) chunkLineStart = sentenceUnit.line;
    if (chunkSentenceStart < 0) chunkSentenceStart = sentenceUnit.sentenceIndex;
    chunkLineEnd = sentenceUnit.line;
    chunkSentenceEnd = sentenceUnit.sentenceIndex;
    
    // 문장이 최대 청크 크기보다 크면 강제로 자름
    if (sentence.length > maxChunkSize - currentChunk.length) {
      let remainingSentence = sentence;
      while (remainingSentence.length > 0) {
        // 현재 청크에 추가할 수 있는 만큼만 자름
        const availableSpace = maxChunkSize - currentChunk.length;
        if (availableSpace <= 0) {
          // 현재 청크가 꽉 찼으면 저장
          pushChunk(currentChunk);
          currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
          resetChunkTracking();
          continue;
        }
        
        const textToAdd = remainingSentence.substring(0, availableSpace);
        currentChunk += textToAdd + ' ';
        
        // 남은 문장 업데이트
        remainingSentence = remainingSentence.substring(availableSpace);
        
        // 현재 청크가 최대 크기에 도달했으면 저장
        if (currentChunk.length >= maxChunkSize) {
          pushChunk(currentChunk);
          currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
          resetChunkTracking();
        }
      }
    } 
    // 청크 크기가 제한을 초과하면 새 청크 시작
    else if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      const chunkText = currentChunk;
      pushChunk(chunkText);
      
      // 오버랩을 위해 마지막 부분 저장
      if (overlap > 0) {
        const words = currentChunk.split(' ');
        lastSentencesBuffer = '';
        
        // 단어 단위로 오버랩 추가
        for (let i = words.length - 1; i >= 0; i--) {
          const tempBuffer = words[i] + ' ' + lastSentencesBuffer;
          if (tempBuffer.length > overlap) {
            break;
          }
          lastSentencesBuffer = tempBuffer;
        }
        
        // 새 청크 시작
        currentChunk = `경전이름 : ${scriptureTitle}\n\n${lastSentencesBuffer}`;
      } else {
        currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
      }
      chunkLineStart = sentenceUnit.line;
      chunkLineEnd = sentenceUnit.line;
      chunkSentenceStart = sentenceUnit.sentenceIndex;
      chunkSentenceEnd = sentenceUnit.sentenceIndex;
    } else {
      // 일반적인 경우 문장 추가
      currentChunk += sentence + ' ';
    }
    
    // 청크가 최대 크기에 도달하면 저장
    if (currentChunk.length >= maxChunkSize) {
      pushChunk(currentChunk);
      currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
      resetChunkTracking();
    }
  }
  
  // 마지막 청크가 남아있으면 추가
  if (currentChunk.length > 0 && currentChunk !== `경전이름 : ${scriptureTitle}\n\n`) {
    pushChunk(currentChunk);
  }
  
  return chunks;
} 