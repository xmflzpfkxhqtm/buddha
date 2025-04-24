'use client';

import { useRouter } from 'next/navigation';
import { useAskStore } from '../../../stores/askStore';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Loading from '../../../../components/Loading';

export default function ConfirmPage() {
  const router = useRouter();
  const { question, setQuestion, parentId, setParentId, selectedLength } = useAskStore();

  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  const [previousQA, setPreviousQA] = useState<{ question: string; answer: string } | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);

  const questionIdRef = useRef<string | null>(null); // ✅ 새로 추가됨

  useEffect(() => {
    // 백엔드 API pre-warm
    fetch('/api/ask/ping').catch(() => {});
  }, []);

  useEffect(() => {
    const fetchPrevious = async () => {
      if (!parentId) return;
      const { data, error } = await supabase
        .from('temp_answers')
        .select('question, answer')
        .eq('id', parentId)
        .single();
      if (data && !error) {
        setPreviousQA({ question: data.question, answer: data.answer });
      }
    };
    fetchPrevious();
  }, [parentId]);

  // ✅ 백그라운드 복귀 후 재전송 로직
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && fadeOut && questionIdRef.current) {
        router.push(`/answer?questionId=${questionIdRef.current}`);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fadeOut]);

  const handleSubmit = async () => {
    if (!question) return;

    setIsLoading(true);
    setShowLoading(true);

    try {
      const minimumTimePromise = new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, parentId, length: selectedLength }),
      });

      type AskResponse = {
        questionId?: string;
        error?: string;
      };

      let data: AskResponse = {};
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('❌ JSON 파싱 실패:', jsonError);
        alert('서버 응답이 올바르지 않습니다.');
        setIsLoading(false);
        setShowLoading(false);
        return;
      }

      await minimumTimePromise;

      if (response.ok && data.questionId) {
        questionIdRef.current = data.questionId; // ✅ push 실패 대비 ref 저장
        setQuestion('');
        setParentId(null);
        setFadeOut(true);

        await new Promise((resolve) => setTimeout(resolve, 1000)); // ✅ 안정성 개선
        router.push(`/answer?questionId=${data.questionId}`);
      } else {
        alert(data?.error || '답변을 받아오는 데 실패했습니다.');
        setIsLoading(false);
        setShowLoading(false);
      }
    } catch (error) {
      console.error('❌ fetch 실패 또는 네트워크 오류:', error);
      if (!isLoading) return;
      alert('잠시 후 다시 시도해주세요.');
      setIsLoading(false);
      setShowLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/ask');
  };

  const handleCancelFollowup = () => {
    setConfirmCancelModal(true);
  };

  const confirmCancel = () => {
    setParentId(null);
    setQuestion('');
    setPreviousQA(null);
    setConfirmCancelModal(false);
    router.replace('/ask');
  };

  if (showLoading) return <Loading fadeOut={fadeOut} />;

  return (
    <>
      <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
        <div className="w-full z-1 pt-8">
          <h2 className="text-3xl text-red font-semibold text-start mb-4">
            부처님께 여쭈기 전,
            <br />마음을 다시 한번 바라보세요
          </h2>
          <p className="text-base text-red font-medium text-start mb-6">
            작성한 내용을 확인하시고, <br />준비되셨다면 마음을 전해 보세요.
          </p>
        </div>

        {previousQA && (
          <div className="w-full bg-[#FFFDF8] border border-gray-200 p-4 mt-2 mb-4 rounded-xl text-sm">
            <p className="text-gray-500 font-medium mb-1">📌 이전 질문</p>
            <p className="text-black font-semibold mb-2 whitespace-pre-wrap">{previousQA.question}</p>
            <p className="text-gray-500 font-medium mb-1">🪷 부처님의 응답</p>
            <p className="text-black italic whitespace-pre-wrap">{previousQA.answer}</p>
            <button
              onClick={handleCancelFollowup}
              className="text-sm text-red mt-2 float-right"
            >
              이전 질문 삭제
            </button>
          </div>
        )}

        <div className="min-h-[12rem] w-full bg-[#FFFDF8] border border-red-light rounded-xl p-4 text-base text-gray-500 whitespace-pre-wrap mb-4">
          {question}
        </div>

        <div className="flex flex-row w-full space-x-6 mb-4">
          <p className="text-start text-red text-sm mb-4">
            고요히 응시한 물음일수록, 그 안에 담긴 마음의 결이 섬세할수록<br />
            부처님의 가르침은 더욱 깊고 분명하게 되돌아옵니다.<br /><br />
            질문에는 상황과 감정을 구체적으로 담아보세요.<br />
            질문이 자세할수록, 답변도 깊어집니다.
          </p>
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

      {confirmCancelModal && (
        <div
          onClick={() => setConfirmCancelModal(false)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-[90%] max-w-[360px] text-center shadow-xl"
          >
            <p className="text-lg font-semibold text-red mb-4">정말 추가 질문을 취소할까요?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmCancelModal(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600"
              >
                아니오
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-light text-white rounded-lg text-sm"
              >
                네, 취소할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
