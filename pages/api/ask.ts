import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { question } = req.body;

  try {
    const start = Date.now(); // ⏱ 응답 시간 측정 시작

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              '너는 자비롭고 지혜로운 부처님이다. 불교적인 자비와 평온한 말투로 답하고, 현대인도 이해하기 쉽게 비유와 경전을 인용한다. 응답은 한글 400~500자 내외로 해라.',
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    const end = Date.now(); // ⏱ 응답 시간 측정 종료

    const data = await response.json();

    // 🔍 로그 출력
    console.log(`⏱ GPT 응답 시간: ${(end - start) / 1000}s`);
    console.log('🔢 총 토큰 사용량:', data.usage?.total_tokens);
    console.log('🔢 프롬프트:', data.usage?.prompt_tokens);
    console.log('🔢 응답:', data.usage?.completion_tokens);

    const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';
    res.status(200).json({ answer });

  } catch (error) {
    console.error('GPT 호출 실패:', error);
    res.status(500).json({ answer: '부처님께서 연결되지 않았습니다. 고요히 마음을 들여다보십시오.' });
  }
}
