'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const router = useRouter();

  const handleAsk = async () => {
    if (!question.trim()) return;

    // GPT API 없이도 작동하도록 더미 응답
    const fakeAnswer = `고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다.
    고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다.
    고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다.
    
    고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다. 고요히 마음을 들여다보십시오. 괴로움도, 기쁨도 모두 지나가는 구름과 같습니다.`;

    // URL 파라미터로 질문과 응답을 전달
    const encodedAnswer = encodeURIComponent(fakeAnswer);
    router.push(`/answer?question=${encodeURIComponent(question)}&answer=${encodedAnswer}`);
  };

  return (
<main className="relative min-h-screen w-full max-w-[430px] pb-[calc(2.25rem+env(safe-area-inset-bottom))] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10">
  <div className="absolute top-0 left-0 w-full h-50 bg-brown z-0"></div>
  <div className="w-full h-10 z-1">      
  <h2 className="text-xl text-white font-bold text-center">마음 속 이야기를 나누고<br></br>
부처님의 지혜에 귀 기울여 보세요</h2>
</div>
<div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
<img
    src="/vipoff.png"
    alt="부처님"
    className="w-36 h-36 object-contain mb-2"
  />  
</div>
      <div className="max-w-md w-full z-1">
        <textarea
          className="w-full h-40 p-4 rounded border border-[#CBBBA0] bg-[#FFFDF8] text-base resize-none focus:outline-none focus:ring-2 focus:ring-[#B29E7D]"
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="고민을 적어보세요..."
        />
      </div>
      <button
          className="mt-auto w-full py-2 bg-brown text-white rounded-xl font-semibold hover:bg-[#9C886D] transition"
          onClick={handleAsk}
        >
          부처님께 여쭙기
        </button>
    </main>
  );
}
