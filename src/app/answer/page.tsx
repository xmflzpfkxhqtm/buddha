'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense, useRef } from 'react';
import Loading from '../../../components/Loading';

function AnswerContent() {
  const params = useSearchParams();
  const question = params?.get('question') || '';
  const [fullAnswer, setFullAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const router = useRouter();
  const bufferRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showLoading, setShowLoading] = useState(true);


  useEffect(() => {
    if (!question) return;

    const fetchStream = async () => {
      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        if (!response.ok || !response.body) throw new Error('스트리밍 응답 실패');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        setLoading(false);

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk;
          bufferRef.current = buffer;
        }

        const cleaned = bufferRef.current
        .replace(/^\s*[{"]*answer["']*\s*:\s*"?/, '') // ✅ 마지막 " → "? 로 바꿔서 선택적으로 제거
        .replace(/"\s*}\s*$/, '')                    // ✅ 맨 끝 " 또는 } 제거
        .replace(/\\n/g, '\n')                       // ✅ 줄바꿈 복원
        .replace(/\\"/g, '"');                       // ✅ \" → " 로 변환
      

      

        setFullAnswer(cleaned);
        setDone(true);
      } catch (error) {
        console.error('GPT 스트리밍 실패:', error);
        setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        setDone(true);
        setLoading(false);
      }
    };

    fetchStream();
  }, [question]);

  useEffect(() => {
    if (!fullAnswer) return;

    let index = 0;
    intervalRef.current = setInterval(() => {
      const nextChar = fullAnswer.charAt(index);
      if (nextChar) {
        setDisplayedAnswer((prev) => prev + nextChar);
      }
      index++;
    
      if (index >= fullAnswer.length && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 20);
    

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fullAnswer])

  useEffect(() => {
    if (fullAnswer) {
      setFadeOut(true); // 🔄 문구 + 투명도 변경
  
      const timeout = setTimeout(() => {
        setShowLoading(false); // 🔥 로딩 컴포넌트 완전 제거
      }, 1000); // transition-duration과 일치
  
      return () => clearTimeout(timeout); // cleanup
    }
  }, [fullAnswer]);
  

if (showLoading) return <Loading fadeOut={fadeOut} />;

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10">
      <div className="absolute top-0 left-0 w-full h-50 shadow-xl bg-brown z-0"></div>

      <div className="w-full h-10 z-1">
        <h2 className="text-xl text-white font-bold text-center">
          부처님이라면 분명<br />이렇게 말씀하셨을 것입니다
        </h2>
      </div>

      <div className="w-full h-30 items-center flex flex-col z-1 mt-6 mb-10">
        <img
          src="/vipon.png"
          alt="부처님"
          className="w-36 h-36 object-contain mb-2"
        />
      </div>

      <div className="max-w-md w-full">
        <p className="font-bold text-lg text-left mb-4">🪷 이르시길</p>
        <div className="p-4 rounded-xl shadow-xl border border-[#CBBBA0] mb-6 whitespace-pre-wrap text-base font-bold text-[#4B3B2A] min-h-[160px]">
          {displayedAnswer}
        </div>

        <h2 className="text-lg font-bold text-[#4B3B2A] mb-4">🧘🏻‍♀️ 나의 물음</h2>
        <div className="p-4 rounded-xl shadow-xl border border-[#CBBBA0] whitespace-pre-wrap text-[#4B3B2A] mb-4">
          {question}
        </div>
      </div>

      {done && (
        <button
          onClick={() => router.push('/')}
          className="mt-6 w-full px-6 py-3 font-bold bg-brown text-lg text-white rounded-xl hover:bg-[#9C886D] transition"
        >
          처음으로
        </button>
      )}
    </main>
  );
}

export default function AnswerPage() {
  return (
    <Suspense fallback={<div className="p-4">로딩 중...</div>}>
      <AnswerContent />
    </Suspense>
  );
}