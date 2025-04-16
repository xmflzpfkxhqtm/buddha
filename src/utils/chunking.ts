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
  
  // 단순하게 _GPT 이후의 모든 부분을 제거
  const cleaned = name.replace(/_GPT.*$/, '');
  
  console.log('정리 후 이름:', cleaned);
  return cleaned;
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
  // 경전 이름 추출 (파일명에서 _GPT4.1번역.txt와 같은 부분 제거)
  const scriptureTitle = cleanScriptureTitle(path.basename(fileName, '.txt'));
  console.log(`경전 이름: ${scriptureTitle}`);
  
  // 문장 구분자로 텍스트 분할
  const sentenceSeparators = ['.', '!', '?', '。', '！', '？', '\n'];
  
  // 문장 단위로 분할
  const sentences: string[] = [];
  let lastIndex = 0;
  let match;
  
  const combinedRegex = new RegExp(`[${sentenceSeparators.join('')}]`, 'g');
  
  while ((match = combinedRegex.exec(text)) !== null) {
    sentences.push(text.substring(lastIndex, match.index + 1).trim());
    lastIndex = match.index + 1;
  }
  
  // 마지막 문장이 남아있으면 추가
  if (lastIndex < text.length) {
    sentences.push(text.substring(lastIndex).trim());
  }
  
  // 청크 생성
  const chunks: { text: string, metadata: DocumentMetadata }[] = [];
  let currentChunk = '';
  let lastSentencesBuffer = '';
  
  for (const sentence of sentences) {
    // 현재 청크가 비어있으면 헤더 추가
    if (currentChunk === '') {
      currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
    }
    
    // 문장이 최대 청크 크기보다 크면 강제로 자름
    if (sentence.length > maxChunkSize - currentChunk.length) {
      let remainingSentence = sentence;
      while (remainingSentence.length > 0) {
        // 현재 청크에 추가할 수 있는 만큼만 자름
        const availableSpace = maxChunkSize - currentChunk.length;
        if (availableSpace <= 0) {
          // 현재 청크가 꽉 찼으면 저장
          chunks.push({
            text: currentChunk,
            metadata: {
              fileName,
              source: scriptureTitle,
              hash: generateContentHash(currentChunk)
            }
          });
          currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
          continue;
        }
        
        const textToAdd = remainingSentence.substring(0, availableSpace);
        currentChunk += textToAdd + ' ';
        
        // 남은 문장 업데이트
        remainingSentence = remainingSentence.substring(availableSpace);
        
        // 현재 청크가 최대 크기에 도달했으면 저장
        if (currentChunk.length >= maxChunkSize) {
          chunks.push({
            text: currentChunk,
            metadata: {
              fileName,
              source: scriptureTitle,
              hash: generateContentHash(currentChunk)
            }
          });
          currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
        }
      }
    } 
    // 청크 크기가 제한을 초과하면 새 청크 시작
    else if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      const chunkText = currentChunk;
      chunks.push({
        text: chunkText,
        metadata: {
          fileName,
          source: scriptureTitle,
          hash: generateContentHash(chunkText)
        }
      });
      
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
    } else {
      // 일반적인 경우 문장 추가
      currentChunk += sentence + ' ';
    }
    
    // 청크가 최대 크기에 도달하면 저장
    if (currentChunk.length >= maxChunkSize) {
      chunks.push({
        text: currentChunk,
        metadata: {
          fileName,
          source: scriptureTitle,
          hash: generateContentHash(currentChunk)
        }
      });
      currentChunk = `경전이름 : ${scriptureTitle}\n\n`;
    }
  }
  
  // 마지막 청크가 남아있으면 추가
  if (currentChunk.length > 0 && currentChunk !== `경전이름 : ${scriptureTitle}\n\n`) {
    chunks.push({
      text: currentChunk,
      metadata: {
        fileName,
        source: scriptureTitle,
        hash: generateContentHash(currentChunk)
      }
    });
  }
  
  return chunks;
} 