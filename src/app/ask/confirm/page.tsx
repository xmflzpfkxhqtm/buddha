'use client';

import { useRouter } from 'next/navigation';
import { useAskStore } from '../../../stores/askStore';
import { useState } from 'react';
import { useEffect } from 'react';
import Loading from '../../../../components/Loading';

export default function ConfirmPage() {
  const router = useRouter();
  const { question, setQuestion } = useAskStore(); // ✅ 추가

  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const handleBack = () => {
    router.push('/ask');
  };

  const handleSubmit = async () => {
    if (!question) return;

    setIsLoading(true);
    setShowLoading(true);

    try {
      // 최소 3초 타이머
      const minimumTimePromise = new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();

      // 두 작업(GPT 응답 + 최소 시간) 병렬 대기
      await minimumTimePromise;

      if (response.ok && data.questionId) {
        setQuestion(''); // 질문 전송 이후에만 초기화
        setFadeOut(true);
        setTimeout(() => {
          router.push(`/answer?questionId=${data.questionId}`);
        }, 1000); // fadeOut 타이밍
      } else {
        alert(data.error || '답변을 받아오는 데 실패했습니다.');
        setIsLoading(false);
        setShowLoading(false);
      }
    } catch (error) {
      console.error('서버 오류:', error);
      alert('잠시 후 다시 시도해주세요.');
      setIsLoading(false);
      setShowLoading(false);
    }
  };

  // ✅ 로딩화면 표시
  if (showLoading) return <Loading fadeOut={fadeOut} />;

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
      <div className="w-full z-1 pt-12">
        <h2 className="text-3xl text-red font-semibold text-start mb-4">
          부처님께 여쭈기 전,
          <br />마음을 다시 한번 바라보세요
        </h2>
        <p className="text-base text-red font-medium text-start mb-6">
          작성한 내용을 확인하시고, <br />준비되셨다면 마음을 전해 보세요.
        </p>
      </div>

      <div className="min-h-[12rem] w-full bg-[#FFFDF8] border border-red-light rounded-xl p-4 text-base text-gray-700 whitespace-pre-wrap mb-4">
        {question}
      </div>

      <div className="flex flex-row w-full space-x-6 mb-12">
        <button
          onClick={handleBack}
          className="w-full px-1 py-3 font-bold border border-red bg-white text-lg text-red-dark rounded-4xl hover:bg-red hover:text-white transition"
        >
          수정하기
        </button>

        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full px-1 py-3 font-bold bg-red-light text-lg text-white rounded-4xl hover:bg-red transition disabled:opacity-50"
        >
          {isLoading ? '부처님께 전송 중...' : '제출하기'}
        </button>
      </div>
    </main>
  );
}
