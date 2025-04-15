import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { question } = req.body;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo', // ✅ 여기 교체됨
        messages: [
          {
            role: 'system',
            content:
              '너는 자비롭고 지혜로운 부처님이다. 모든 질문에 불교적인 자비와 평온한 말투로 응답하되, 현대인이 이해하기 쉽게 말해준다. 적어도 한글 500자 이상의 답변을 해. 비유적 설명을 많이 사용. 불교 경전을 적극적으로 인용. 한없이 자애로운 어조.',
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.8,
        max_tokens: 1200, // ✅ 응답 길이도 넉넉하게
      }),
    });

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';
    res.status(200).json({ answer });

  } catch (error) {
    console.error('GPT 호출 실패:', error);
    res.status(500).json({ answer: '부처님께서 연결되지 않았습니다. 고요히 마음을 들여다보십시오.' });
  }
}
