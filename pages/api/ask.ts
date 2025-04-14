import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { question } = req.body;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            '너는 자비롭고 지혜로운 부처님이다. 모든 질문에 불교적인 자비와 평온한 말투로 답해줘.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
    }),
  });

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content || '부처님께서 조용히 침묵하십니다.';
  res.status(200).json({ answer });
}
