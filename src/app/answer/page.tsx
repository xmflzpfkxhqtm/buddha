'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense, useRef } from 'react';
import html2canvas from 'html2canvas';
import Loading from '../../../components/Loading';
import BottomNav from '../../../components/BottomNav'; 

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
  const answerRef = useRef(null); // ✅ 캡처용 ref

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
  }, [fullAnswer]);

  useEffect(() => {
    if (fullAnswer) {
      setFadeOut(true);
      const timeout = setTimeout(() => {
        setShowLoading(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [fullAnswer]);

  const handleEdit = () => {
    router.push(`/ask?question=${encodeURIComponent(question)}&model=${model}`);
  };

  const handleSave = async () => {
    if (!answerRef.current) return;
    const canvas = await html2canvas(answerRef.current);
    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'buddha-answer.png';
    link.click();
  };

  if (showLoading) return <Loading fadeOut={fadeOut} />;

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
      

      {/* ✅ 캡처 대상 시작 */}
      <div ref={answerRef} className="rounded-2xl py-6 px-2">
      <div className="w-full z-1 mt-4">
        <h2 className="text-2xl text-red font-semibold text-start">
          부처님이라면 분명<br />이렇게 말씀하셨을 것입니다
        </h2>
      </div>
        <div className="w-full h-12 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
          <p className="pl-2 text-white text-start font-semibold">🪷 이르시길</p>
        </div>

        <div className="max-w-md w-full pt-4">
          <div className="p-4 rounded-xl shadow-xl border font-maruburi border-red mb-6 whitespace-pre-wrap text-base font-bold text-black min-h-[160px]">
            {displayedAnswer}
          </div>
          <div className="w-full h-12 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
            <p className="pl-2 text-white text-start font-semibold">🪷 나의 물음</p>
          </div>
          <div className="p-4 rounded-xl whitespace-pre-wrap text-black mt-2">
            "{question}"
          </div>
        </div>
      </div>
      {/* ✅ 캡처 대상 끝 */}

      {done && (
        <div className="flex flex-row w-full space-x-4 mb-12 px-2">
          <button
            onClick={handleEdit}
            className="w-full py-3 border border-red text-red-dark font-bold rounded-4xl hover:bg-red hover:text-white transition"
          >
            질문 수정하기
          </button>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition"
          >
            저장하기
          </button>
        </div>
      )}
      <BottomNav />
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
