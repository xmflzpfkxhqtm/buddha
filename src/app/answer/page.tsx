'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense, useRef } from 'react';
import Image from 'next/image';
import Loading from '../../../components/Loading';

function AnswerContent() {
  const params = useSearchParams();
  const question = params?.get('question') || '';
  const model = params?.get('model') || 'gpt4.1';
  const [fullAnswer, setFullAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [done, setDone] = useState(false);
  const [, setLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [showLoading, setShowLoading] = useState(true);
  const isApiCalled = useRef(false);
  const [usedModel, setUsedModel] = useState(model);

  useEffect(() => {
    if (!question || isApiCalled.current) return;
    
    isApiCalled.current = true;
    setLoading(true);
    
    const fetchAnswer = async () => {
      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, model }),
        });

        if (!response.ok) throw new Error('응답 실패');

        const data = await response.json();
        
        if (data && data.answer) {
          setFullAnswer(data.answer);
          if (data.model) {
            setUsedModel(data.model);
          }
        } else {
          throw new Error('응답 데이터가 올바르지 않습니다');
        }

        setDone(true);
        setLoading(false);
      } catch (error) {
        console.error('API 호출 실패:', error);
        setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        setDone(true);
        setLoading(false);
      }
    };

    fetchAnswer();
  }, [question, model]);

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
  

  // 모델 이름 매핑
  const getModelDisplayName = (modelId: string) => {
    switch(modelId) {
      case 'gpt4.1': return 'GPT-4.1';
      case 'gpt4o': return 'GPT-4o';
      case 'gpt-4.1-mini': return 'GPT-4.1 Mini';
      case 'claude3.7': return 'Claude 3.7';
      case 'gemini-2.5-pro': return 'Gemini 2.5 Pro';
      case 'o4-mini': return 'O4 Mini';
      case 'grok': return 'Grok 3';
      default: return modelId;
    }
  };

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
        <Image
          src="/vipon.png"
          alt="부처님"
          width={144}
          height={144}
          className="w-36 h-36 object-contain mb-2"
        />
        <div className="bg-[#8A7350] text-white text-xs px-2 py-1 rounded-full">
          {getModelDisplayName(usedModel)}
        </div>
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