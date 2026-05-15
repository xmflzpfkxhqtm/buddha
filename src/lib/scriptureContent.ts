// src/lib/scriptureContent.ts
// 경전 markdown 콘텐츠 → sentence flat array / block structure 파서.
// Layer 3 reader 와 server-side highlight resolve API 가 *동일 결과* 산출해야
// sentence_index 가 일치 (highlight 좌표 안정성 보장).
//
// 옛 /scripture/page.tsx 의 인라인 로직과도 동일해야 함 (Capacitor 옛 캐시 호환).
// 변경 시 반드시 3곳 동기화: 본 파일 + 옛 page.tsx + (자동) 임포트 사용처들.

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'hr' }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'paragraph'; sentences: string[] };

export type ReadUnit = {
  text: string;
  kind: 'heading' | 'quote' | 'paragraph';
};

export type ParsedContent = {
  blocks: MarkdownBlock[];
  flatSentences: string[];
  flatReadUnits: ReadUnit[];
};

const EMPHASIS_PATTERN = /\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|\*[^*]+?\*/g;

const hasUnmatchedEmphasis = (s: string): boolean =>
  s.replace(EMPHASIS_PATTERN, '').includes('*');

/**
 * 한 단락 텍스트를 sentence array 로. emphasis (`*..*`) 가 sentence 경계 넘어가면
 * 다시 합쳐서 markdown 렌더가 깨지지 않게 한다.
 */
export const splitSentences = (text: string): string[] => {
  const raw = text
    .split(/(?<=[.!?]["”'’]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (raw.length <= 1) return raw;

  const merged: string[] = [];
  let buffer = '';
  for (const sentence of raw) {
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
    if (!hasUnmatchedEmphasis(buffer)) {
      merged.push(buffer);
      buffer = '';
    }
  }
  if (buffer) merged.push(buffer);
  return merged;
};

const DHARANI_META = /^>?\s*\*{0,3}\[\s*다라니[^\]]*\]\*{0,3}\s*$/;

/**
 * markdown 본문 → 블록 구조 + flat sentence array.
 *
 * - flatSentences: paragraph block 의 sentence 들만 (highlight 좌표 기준).
 * - flatReadUnits: heading/quote/paragraph 모두 (TTS 인덱스 기준).
 * - blocks: 렌더용 구조.
 *
 * 주의: flatSentences 인덱스가 곧 `highlights.start_sentence` 의 의미.
 * heading/quote 는 빠진다 (이 파서의 결정 — 옛 코드와 동일).
 */
export const parseMarkdownToBlocks = (content: string): ParsedContent => {
  const lines = content.split('\n');
  const blocks: MarkdownBlock[] = [];
  const flatSentences: string[] = [];
  const flatReadUnits: ReadUnit[] = [];
  let paragraphBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const paragraphText = paragraphBuffer.join(' ').trim();
    paragraphBuffer = [];
    if (!paragraphText) return;
    const sentences = splitSentences(paragraphText);
    if (sentences.length === 0) return;
    blocks.push({ type: 'paragraph', sentences });
    flatSentences.push(...sentences);
    flatReadUnits.push(...sentences.map((text) => ({ text, kind: 'paragraph' as const })));
  };

  const flushQuote = () => {
    if (quoteBuffer.length === 0) return;
    const qLines = quoteBuffer
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
    quoteBuffer = [];
    if (qLines.length === 0) return;
    blocks.push({ type: 'blockquote', lines: qLines });
    flatReadUnits.push(...qLines.map((text) => ({ text, kind: 'quote' as const })));
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (DHARANI_META.test(trimmed)) return;

    if (trimmed === '') {
      flushParagraph();
      flushQuote();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushQuote();
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      flatReadUnits.push({ text: headingMatch[2].trim(), kind: 'heading' });
      return;
    }

    if (trimmed === '---') {
      flushParagraph();
      flushQuote();
      blocks.push({ type: 'hr' });
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      quoteBuffer.push(quoteMatch[1]);
      return;
    }

    flushQuote();
    paragraphBuffer.push(trimmed);
  });

  flushParagraph();
  flushQuote();

  return { blocks, flatSentences, flatReadUnits };
};
