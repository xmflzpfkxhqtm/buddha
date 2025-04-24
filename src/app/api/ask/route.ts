export const runtime = 'nodejs';


import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { searchSimilarDocuments } from '@/utils/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from '@/lib/supabaseClient';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';

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

interface ChatMessage {
  role: string;
  content: string;
}

async function callOpenAI(messages: ChatMessage[], model: string, maxTokens: number) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: maxTokens })
  });
  
  if (!response.ok) {
    const errText = await response.text();
    console.error('🔥 OpenAI 응답 오류:', response.status, errText);
    throw new Error(`OpenAI 응답 실패: ${response.status}`);
  }

  return await response.json();
}

async function callClaude(messages: ChatMessage[], model: string, maxTokens: number) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessage = messages.find(m => m.role === 'user')?.content || '';

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.8,
    system: systemMessage,
    messages: [
      { role: 'user', content: [{ type: 'text', text: userMessage }] }
    ]
  });

  const textBlock = response.content.find((block): block is TextBlock => block.type === 'text');
  const messageText = textBlock?.text || '';

  return {
    choices: [{ message: { content: messageText } }],
    usage: response.usage
  };
}

async function callGemini(messages: ChatMessage[], model: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const genModel = genAI.getGenerativeModel({ model });
  const prompt = `${messages[0].content}\n\n${messages[1].content}`;
  const result = await genModel.generateContent(prompt);
  return {
    choices: [{ message: { content: result.response.text() } }],
    usage: { total_tokens: 0 }
  };
}

async function callGrok(messages: ChatMessage[], model: string, maxTokens: number) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const user = messages.find(m => m.role === 'user')?.content || '';

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('🔥 Grok 응답 오류:', response.status, errText);
    throw new Error(`Grok 응답 실패: ${response.status}`);
  }

  const data = await response.json();
  return {
    choices: [{ message: { content: data.choices?.[0]?.message?.content || '' } }],
    usage: data.usage
  };
}
type AskRequestBody = {
  question?: string;
  model?: string;
  length?: 'short' | 'long';
  parentId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    let body: AskRequestBody = {}; // ✅ any 대신 명확한 타입 사용

    try {
      body = await request.json();
    } catch (err) {
      console.error('❌ JSON 파싱 실패:', err);
      return NextResponse.json({ success: false, message: '요청 본문이 비어있거나 잘못되었습니다.' }, { status: 400 });
    }

    const { question, model = 'gpt4.1-mini', length = 'long', parentId = null } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ success: false, message: '질문이 유효하지 않습니다.' }, { status: 400 });
    }
    
    const { charLimit, maxTokens } = lengthSetting[length as keyof typeof lengthSetting] || lengthSetting.long;

    let previousQA = '';
    if (parentId) {
      const { data: parent } = await supabase.from('temp_answers').select('question, answer').eq('id', parentId).single();
      if (parent) {
        previousQA = `이전 질문: ${parent.question}\n부처님의 응답: ${parent.answer}\n\n`;
      }
    }

    const [questionEmbedding] = await generateEmbeddingBatch([question]);
    const relevantDocuments = await searchSimilarDocuments(questionEmbedding, 10);
    const contextText = relevantDocuments.map(doc => doc.content).join('\n\n');

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

    const apiModel = modelMapping[model as keyof typeof modelMapping] || 'gpt-4.1-mini';
    let data;
    
    try {
      if (model === 'gpt-4.1-mini') {
        data = await callOpenAI(messages, apiModel, maxTokens);
      } else if (model.startsWith('claude')) {
        data = await callClaude(messages, apiModel, maxTokens);
      } else if (model.startsWith('gemini')) {
        data = await callGemini(messages, apiModel);
      } else if (model === 'grok') {
        data = await callGrok(messages, apiModel, maxTokens);
      } else {
        // fallback은 무조건 gpt-4.1-mini
        data = await callOpenAI(messages, 'gpt-4.1-mini', maxTokens);
      }
    } catch (apiError) {
      console.warn('⚠️ API 모델 호출 실패, fallback 시도:', apiError);
      data = await callOpenAI(messages, 'gpt-4.1-mini', maxTokens);
    }
    
    const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';
    console.log('📊 사용 토큰 정보:', { model, usage: data.usage, question, length });

    const { data: inserted, error } = await supabase
      .from('temp_answers')
      .insert([{ question, answer, parent_id: parentId }])
      .select()
      .single();

    if (error || !inserted) {
      console.error('❌ Supabase 저장 실패:', error);
      return NextResponse.json({ success: false, message: 'Supabase 저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, questionId: inserted.id });
  
  } catch (error: unknown) {
    console.error('❌ 최상위 오류 발생:', error);
  
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