import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';

export interface ChatMessage {
  role: string;
  content: string;
}

export async function callOpenAI(messages: ChatMessage[], model: string, maxTokens: number) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('OpenAI 응답 오류:', response.status, errText);
    throw new Error(`OpenAI 응답 실패: ${response.status}`);
  }

  return response.json();
}

export async function callClaude(messages: ChatMessage[], model: string, maxTokens: number) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const userMessage = messages.find(m => m.role === 'user')?.content || '';

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.8,
    system: systemMessage,
    messages: [{ role: 'user', content: [{ type: 'text', text: userMessage }] }],
  });

  const textBlock = response.content.find((block): block is TextBlock => block.type === 'text');
  return {
    choices: [{ message: { content: textBlock?.text || '' } }],
    usage: response.usage,
  };
}

export async function callGemini(messages: ChatMessage[], model: string) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const genModel = genAI.getGenerativeModel({ model });
  const prompt = `${messages[0].content}\n\n${messages[1].content}`;
  const result = await genModel.generateContent(prompt);
  return {
    choices: [{ message: { content: result.response.text() } }],
    usage: { total_tokens: 0 },
  };
}

export async function callGrok(messages: ChatMessage[], model: string, maxTokens: number) {
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
    console.error('Grok 응답 오류:', response.status, errText);
    throw new Error(`Grok 응답 실패: ${response.status}`);
  }

  const data = await response.json();
  return {
    choices: [{ message: { content: data.choices?.[0]?.message?.content || '' } }],
    usage: data.usage,
  };
}
