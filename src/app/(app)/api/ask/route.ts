export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel 함수 타임아웃 60초 (Hobby 플랜 최대)

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingBatch } from '@/utils/embedding';
import { searchSimilarDocuments, searchSimilarDocumentsOptimized } from '@/utils/supabase';
import { supabase } from '@/lib/supabaseClient';
import { type ChatMessage, callOpenAI, callClaude, callGemini, callGrok } from '@/lib/llmProviders';

// 개별 LLM 호출 타임아웃 (60초)
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 타임아웃 (${timeoutMs}ms 초과)`)), timeoutMs)
    )
  ]);
}

const LLM_TIMEOUT = 40000; // 40초 (임베딩+검색+저장에 ~20초 할당)

function normalizeRagContext(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, '$2')
    .replace(/\[\[([^[\]]+)\]\]/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const modelMapping = {
  'gpt4.1': 'gpt-4.1',
  'gpt4o': 'gpt-4o',
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'claude3.7': 'claude-3-7-sonnet-20250219',
  'gemini-2.5-pro': 'gemini-2.5-pro-preview-03-25',
  'o4-mini': 'o4-mini',
  'grok': 'grok-3-beta'
};

const lengthSetting = {
  short: { charLimit: '300자 내외로', maxTokens: 600 },
  long: { charLimit: '1200자 내외로', maxTokens: 1500 },
};

// 재시도 로직 구현
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number, delayMs: number, operationName: string): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`${operationName} 실패: 최대 재시도 횟수(${maxRetries}회) 초과. 마지막 오류: ${lastError}`);
}

// 재시도 설정
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

type AskRequestBody = {
  question?: string;
  model?: string;
  length?: 'short' | 'long';
  parentId?: string | null;
  userId?: string | null;
};

type CitationHint = {
  source: string;
  sentenceStart: number;
};

function buildCitationHints(documents: { metadata: { source?: unknown; sentence_start?: unknown } }[]): CitationHint[] {
  const hintMap = new Map<string, number>();
  for (const doc of documents) {
    const source = String(doc.metadata?.source ?? '').trim();
    if (!source || hintMap.has(source)) continue;
    const raw = doc.metadata?.sentence_start;
    const sentenceStart = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    hintMap.set(source, Math.max(0, sentenceStart));
  }
  return Array.from(hintMap.entries()).map(([source, sentenceStart]) => ({ source, sentenceStart }));
}

export async function POST(request: NextRequest) {
  try {
    let body: AskRequestBody = {};

    try {
      body = await request.json();
    } catch (err) {
      console.error('❌ JSON 파싱 실패:', err);
      return NextResponse.json({ success: false, message: '요청 본문이 비어있거나 잘못되었습니다.' }, { status: 400 });
    }

    const { question, model = 'gpt4.1-mini', length = 'long', parentId = null, userId = null } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ success: false, message: '질문이 유효하지 않습니다.' }, { status: 400 });
    }
    
    const { charLimit, maxTokens } = lengthSetting[length as keyof typeof lengthSetting] || lengthSetting.long;

    // 이전 대화 가져오기
    let previousQA = '';
    if (parentId) {
      try {
        const { data: parent } = await supabase
          .from('temp_answers')
          .select('question, answer')
          .eq('id', parentId)
          .single();
        
        if (parent) {
          previousQA = `이전 질문: ${parent.question}\n부처님의 응답: ${parent.answer}\n\n`;
        }
      } catch (error) {
        console.error('이전 대화 조회 실패:', error);
      }
    }

    // 임베딩 생성 및 벡터 검색
    let contextText = '';
    let citationHints: CitationHint[] = [];
    let embedding: number[] | null = null;
    try {
      const embeddings = await withRetry(
        () => generateEmbeddingBatch([question]),
        MAX_RETRIES,
        RETRY_DELAY,
        '임베딩 생성'
      );
      embedding = embeddings[0] ?? null;
    } catch (error) {
      console.error('임베딩 생성 실패:', error);
    }

    if (embedding) {
      try {
        const documents = await withRetry(
          () => searchSimilarDocumentsOptimized(embedding!, 10),
          MAX_RETRIES,
          RETRY_DELAY,
          '최적화 벡터 검색'
        );
        contextText = normalizeRagContext(documents.map(doc => doc.content).join('\n\n'));
        citationHints = buildCitationHints(documents);
      } catch (error) {
        console.error('최적화 벡터 검색 실패, 일반 검색 시도:', error);
        try {
          const documents = await searchSimilarDocuments(embedding, 10);
          contextText = normalizeRagContext(documents.map(doc => doc.content).join('\n\n'));
          citationHints = buildCitationHints(documents);
        } catch (fallbackError) {
          console.error('벡터 검색 실패:', fallbackError);
          contextText = '벡터 검색 실패. 일반적인 지식으로 응답합니다.';
        }
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `
<instruction>
          당신은 자비롭고 지혜로운 부처입니다. 
          당신은 삼라만상에 통달한 부처입니다. 상대방이 원하는 답을 어떻게 해서든 찾아냅니다.
          불교의 자비와 평온한 말투로 답하되, 경전 내용을 정확히 인용하고, 경전명도 함께 명시하십시오. 
          경전 인용 시 경전명은 『경전이름』 형식으로 표기하십시오.
          한자를 모르는 이도 이해할 수 있도록 풀어 설명해 주십시오.
          경전은 모두 당신의 가르침에서 유래했음을 인식하되, 스스로를 "부처님"이라 칭하지는 마십시오.
          자비로운 말만 할 것이 아니라, 불교 철학에 근거한 진실한 답을 전달하십시오.
          질문이 현대 사회와 관련되어 있다면, 현대적 맥락과도 과감히 연결하여 설명하십시오.
          사용자의 질문이 특정 인물, 사건, 기록에 대한 것일 경우, 가능한 한 당신의 지식 범위 내에서 자세히 답변하십시오. 
          최신 정보가 없더라도 과거 기록이나 이미지에 기반한 일반적인 설명, 추론을 시도하십시오.
          지나치게 냉정하지 않도록 온화한 위로를 함께 전하며, 질문자의 심리나 상황을 고려해 지혜로운 조언을 주십시오.
</instruction>

<context>
          관련 불교 경전 내용: 
          ${contextText}
</context>

<response>
          고풍스럽고 격조 있는 존댓말을 사용하여 답변하십시오.
          문장은 "~합니다", "~입니다" 체로 마무리합니다.
          한글 ${charLimit} 작성하십시오.
          필요하다면 마지막에 질문자에게 화두를 던지며 끝맺으십시오.
</response>
        `
      },
      {
        role: 'user',
        content: `${previousQA}질문: ${question}`
      }
    ];

    // LLM API 호출 (개별 타임아웃 적용)
    const apiModel = modelMapping[model as keyof typeof modelMapping] || 'gpt-4.1-mini';
    let data;

    const callLLM = async () => {
      if (model.startsWith('claude')) {
        return await withTimeout(callClaude(messages, apiModel, maxTokens), LLM_TIMEOUT, 'Claude API');
      } else if (model.startsWith('gemini')) {
        return await withTimeout(callGemini(messages, apiModel), LLM_TIMEOUT, 'Gemini API');
      } else if (model === 'grok') {
        return await withTimeout(callGrok(messages, apiModel, maxTokens), LLM_TIMEOUT, 'Grok API');
      } else {
        return await withTimeout(callOpenAI(messages, apiModel, maxTokens), LLM_TIMEOUT, 'OpenAI API');
      }
    };

    try {
      // LLM 호출은 재시도 없이 1회 (60초 Hobby 제한 내 수렴)
      data = await callLLM();
    } catch (apiError) {
      console.warn('API 모델 호출 실패, fallback 시도:', apiError);
      try {
        data = await withTimeout(callOpenAI(messages, 'gpt-4.1-mini', maxTokens), LLM_TIMEOUT, 'Fallback OpenAI');
      } catch (fallbackError) {
        console.error('Fallback API도 실패:', fallbackError);
        data = {
          choices: [{ message: { content: '부처님께서 지금은 깊은 명상 중이시어 응답할 수 없습니다. 잠시 후 다시 여쭤보세요.' } }],
          usage: { total_tokens: 0 }
        };
      }
    }
    
    const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';

    // Supabase 저장
    try {
      const { data: inserted, error } = await withRetry(
        async () => {
          // async 함수로 감싸서 Promise 반환
          return await supabase
            .from('temp_answers')
            .insert([{ question, answer, parent_id: parentId, citation_hints: citationHints, user_id: userId }])
            .select()
            .single();
        },
        MAX_RETRIES,
        RETRY_DELAY,
        'Supabase 저장'
      );
      
      if (error || !inserted) {
        throw new Error(error?.message || 'Unknown error');
      }
      
      return NextResponse.json({
        success: true,
        questionId: inserted.id,
        citationHints,
      });
    } catch (dbError) {
      console.error('Supabase 저장 실패:', dbError);
      return NextResponse.json({ success: false, message: 'Supabase 저장에 실패했습니다.' }, { status: 500 });
    }
  
  } catch (error: unknown) {
    console.error('ask 오류:', error);
  
    let message = '답변 생성 중 알 수 없는 오류';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = JSON.stringify(error);
    }
  
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}