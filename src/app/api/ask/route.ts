import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddingBatch } from '@/utils/upstage';
import { searchSimilarDocuments, DocumentResult } from '@/utils/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from "@anthropic-ai/sdk";

// 모델 ID와 실제 API 모델 매핑
const modelMapping = {
  'gpt4.1': 'gpt-4.1',
  'gpt4o': 'gpt-4o',
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'claude3.7': 'claude-3-7-sonnet-20250219',
  'gemini-2.5-pro': 'gemini-2.5-pro-preview-03-25',
  'o4-mini': 'o4-mini',
  'grok': 'grok-3-beta'
};

// 메시지 타입 정의
interface ChatMessage {
  role: string;
  content: string;
}

// OpenAI API 호출 함수
async function callOpenAI(messages: ChatMessage[], model: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 800,
    }),
  });
  
  return await response.json();
}

// Anthropic Claude API 호출 함수
async function callClaude(messages: ChatMessage[], model: string) {
  const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
  const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
  
  try {
    console.log(`Claude API 호출 시작: ${model}`);
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 800,
      temperature: 0.8,
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userMessage
            }
          ]
        }
      ]
    });
    
    console.log('Claude 응답 수신 완료');
    
    // content[0]가 text 타입인 경우에만 text 속성 접근
    const textContent = response.content.find(block => block.type === 'text');
    const messageText = textContent?.type === 'text' ? textContent.text : '';
    
    return {
      choices: [
        {
          message: {
            content: messageText
          }
        }
      ],
      usage: response.usage
    };
  } catch (error) {
    console.error('Claude API 호출 오류:', error);
    throw error;
  }
}

// Gemini API 호출 함수
async function callGemini(messages: ChatMessage[], model: string) {
  const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
  const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
  
  try {
    console.log('Gemini API 호출 시작:', model);
    
    // GoogleGenAI 인스턴스 생성
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const genModel = genAI.getGenerativeModel({ model: model });
    
    // 프롬프트 구성
    const promptText = `${systemMessage}\n\n${userMessage}`;
    console.log('Gemini 프롬프트 구성 완료');
    
    // 컨텐츠 생성 요청
    const result = await genModel.generateContent(promptText);
    console.log('Gemini 응답 수신');
    
    // 응답 추출
    const response = result.response;
    const text = response.text();
    
    if (!text) {
      console.error('Gemini API 응답에 텍스트가 없습니다');
      throw new Error('Gemini API 응답에 텍스트가 없습니다');
    }
    
    console.log('Gemini 응답 텍스트 추출 완료:', text.substring(0, 50) + '...');
    
    return {
      choices: [
        {
          message: {
            content: text
          }
        }
      ],
      usage: { total_tokens: 0 }
    };
  } catch (error) {
    console.error('Gemini API 호출 오류:', error);
    
    // 오류 발생 시 GPT-4로 폴백
    console.log('Gemini API 오류로 인해 GPT-4로 대체합니다');
    return await callOpenAI(messages, 'gpt-4.1');
  }
}

// Grok API 호출 함수
async function callGrok(messages: ChatMessage[], model: string) {
  const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
  const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
  
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.8,
      max_tokens: 800,
    }),
  });
  
  const data = await response.json();
  return {
    choices: [
      {
        message: {
          content: data.choices?.[0]?.message?.content || ''
        }
      }
    ],
    usage: data.usage
  };
}

export async function POST(request: NextRequest) {
  try {
    const { question, model = 'gpt4.1' } = await request.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { success: false, message: '질문이 유효하지 않습니다.' },
        { status: 400 }
      );
    }
    
    // 측정 시작
    const start = Date.now();
    
    // 질문을 임베딩 (배치 처리 API를 사용하여 효율성 향상)
    const [questionEmbedding] = await generateEmbeddingBatch([question]);
    
    // 관련 문서 검색 (10개)
    const relevantDocuments = await searchSimilarDocuments(questionEmbedding, 10);
    
    // 관련 문서 유사도 로깅
    console.log('==== 유사 문서 검색 결과 ====');
    relevantDocuments.forEach((doc, index) => {
      console.log(`문서 #${index+1} - 유사도: ${doc.similarity.toFixed(4)}, 출처: ${doc.metadata?.source || '미상'}`);
      console.log(`내용 샘플: ${doc.content.substring(0, 50)}...`);
    });
    console.log('============================');
    
    // 관련 문서가 없는 경우
    if (!relevantDocuments || relevantDocuments.length === 0) {
      return NextResponse.json({
        success: true,
        answer: '부처님께서 침묵하십니다. 관련된 가르침을 찾을 수 없습니다.',
        context: []
      });
    }
    
    // 컨텍스트 준비
    const contextText = relevantDocuments.map((doc: DocumentResult) => doc.content).join('\n\n');
    
    // 메시지 구성
    const messages = [
      {
        role: 'system',
        content:
          `
          <instruction>
          너는 자비롭고 지혜로운 부처님이다. 
          사용자의 질문에 불교적인 자비와 평온한 말투로 답하고, 
          관련 불교 경전 내용을 참고하여 질문에 답하되 경전의 내용을 정확히 인용하라. 
          경전의 이름도 함께 알려주어라.
          질문자의 의도, 심리 상태, 현재 상황을 적극적으로 유추하여 답변하라.
          좋은 말만 하지 말고 불교의 철학, 불교 경전의 내용을 참고하여 정확하게 답변하라.
          한자를 모르는 사람도 이해할 수 있도록 답변하라.
          경전을 참고하되, 너가 부처임을 명심하여 답변. 즉, 모든 경전은 결국 너가 한말임.
          </instruction>

          <context>
         관련 불교 경전 내용: 
         ${contextText}
          </context>

          <response>
          부처님으로서 답변 작성.
          ~다, ~이다의 말투 사용.
          한글 800자 내외로 답변.
          </response>
          `
      },
      {
        role: 'user',
        content: `질문: ${question}`
      },
    ];
    
    // 모델에 따라 다른 API 호출
    let data;
    const apiModel = modelMapping[model as keyof typeof modelMapping] || 'gpt-4.1';
    
    try {
      if (model.startsWith('gpt') || model === 'o4-mini') {
        data = await callOpenAI(messages, apiModel);
      } else if (model.startsWith('claude')) {
        data = await callClaude(messages, apiModel);
      } else if (model.startsWith('gemini')) {
        data = await callGemini(messages, apiModel);
      } else if (model === 'grok') {
        data = await callGrok(messages, apiModel);
      } else {
        // 기본값 - OpenAI
        data = await callOpenAI(messages, 'gpt-4.1');
      }
    } catch (error) {
      console.error(`${model} API 호출 실패:`, error);
      console.log('오류 발생으로 인해 GPT-4로 대체합니다');
      data = await callOpenAI(messages, 'gpt-4.1');
    }
    
    // 측정 종료
    const end = Date.now();
    
    // 로그 출력
    console.log(`⏱ 응답 시간 (${model}): ${(end - start) / 1000}s`);
    console.log('🔢 총 토큰 사용량:', data.usage?.total_tokens);
    
    const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';
    
    // 소스 정보 추출
    const sources = Array.from(new Set(
      relevantDocuments.map((doc: DocumentResult) => doc.metadata?.source).filter(Boolean)
    ));
    
    return NextResponse.json({
      success: true,
      answer,
      sources,
      model: model,
      similarity: relevantDocuments.map((doc: DocumentResult) => ({
        score: isNaN(doc.similarity) ? 0 : Number(doc.similarity.toFixed(4)),
        source: doc.metadata?.source
      }))
    });
    
  } catch (error) {
    console.error('답변 생성 오류:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '답변 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
} 