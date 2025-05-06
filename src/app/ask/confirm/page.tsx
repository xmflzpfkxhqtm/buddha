'use client';

import { useRouter } from 'next/navigation';
import { useAskStore } from '../../../stores/askStore';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Loading from '../../../../components/Loading';

// 재시도 유틸리티 함수
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, delay = 1500): Promise<Response> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // 5xx 서버 오류일 경우만 재시도
      if (response.status >= 500) {
        const errorText = await response.text();
        throw new Error(`서버 오류 ${response.status}: ${errorText}`);
      }
      
      // 4xx 클라이언트 오류는 재시도하지 않고 바로 반환
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ API 요청 실패 (시도 ${attempt}/${maxRetries}):`, error);
      
      if (attempt < maxRetries) {
        console.log(`🔄 ${delay}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`API 요청 실패: 최대 재시도 횟수(${maxRetries}회) 초과. 마지막 오류: ${lastError}`);
}

export default function ConfirmPage() {
  const router = useRouter();
  const { question, setQuestion, parentId, setParentId, selectedLength } = useAskStore();

  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previousQA, setPreviousQA] = useState<{ question: string; answer: string } | null>(null);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);

  const questionIdRef = useRef<string | null>(null); // ✅ 새로 추가됨
  const warmupAttempted = useRef(false);
  const submitAttemptCount = useRef(0);

  // API 웜업 함수 - 수파베이스 벡터 검색만 웜업하는 함수
  const warmupApi = async () => {
    if (warmupAttempted.current) return;
    warmupAttempted.current = true;
    
    try {
      console.log('✅ 벡터 검색 및 임베딩 API 웜업 시작...');
      
      // 가벼운 샘플 질문으로 웜업 요청 전송 (재시도 로직 적용)
      const warmupResponse = await fetchWithRetry(
        '/api/ask/warmup', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: '평온한 마음을 가지려면 어떻게 해야 하나요?'
          })
        },
        3,  // 최대 3회 재시도
        1000 // 1초 간격
      );
      
      if (warmupResponse.ok) {
        console.log('✅ API 웜업 성공');
        const data = await warmupResponse.json();
        console.log('📊 웜업 통계:', data?.stats);
      } else {
        console.warn('⚠️ API 웜업 응답 실패:', await warmupResponse.text());
      }
    } catch (error) {
      console.error('❌ API 웜업 요청 실패:', error);
    }
  };

  useEffect(() => {
    // 페이지 로드 즉시 API 웜업 시작
    warmupApi();
    
    // 기존 핑 요청도 유지 (재시도 로직 적용)
    fetchWithRetry('/api/ask/ping', {}, 3, 1000)
      .catch(() => console.warn('⚠️ 핑 요청 실패'));
  }, []);

  useEffect(() => {
    const fetchPrevious = async () => {
      if (!parentId) return;
      try {
        const { data, error } = await supabase
          .from('temp_answers')
          .select('question, answer')
          .eq('id', parentId)
          .single();
        if (data && !error) {
          setPreviousQA({ question: data.question, answer: data.answer });
        }
      } catch (error) {
        console.error('❌ 이전 대화 조회 실패:', error);
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
  }, [fadeOut, router]);

  const handleSubmit = async () => {
    if (!question) return;

    setIsLoading(true);
    setShowLoading(true);
    setErrorMessage(null);
    submitAttemptCount.current += 1;
    const currentAttempt = submitAttemptCount.current;

    try {
      const minimumTimePromise = new Promise((resolve) => setTimeout(resolve, 3000));

      // 재시도 로직 적용한 fetch 사용
      const response = await fetchWithRetry(
        '/api/ask',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, parentId, length: selectedLength }),
        },
        3,  // 최대 3회 재시도
        2000 // 2초 간격
      );

      type AskResponse = {
        questionId?: string;
        error?: string;
        message?: string;
      };

      let data: AskResponse = {};
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('❌ JSON 파싱 실패:', jsonError);
        throw new Error('서버 응답이 올바르지 않습니다.');
      }

      await minimumTimePromise;

      // 현재 시도가 최신 시도인지 확인 (중복 제출 방지)
      if (currentAttempt !== submitAttemptCount.current) {
        console.log('🔄 더 최근 제출이 있어 이 응답은 무시됨');
        return;
      }

      if (response.ok && data.questionId) {
        questionIdRef.current = data.questionId; // ✅ push 실패 대비 ref 저장
        setQuestion('');
        setParentId(null);
        setFadeOut(true);

        await new Promise((resolve) => setTimeout(resolve, 1000)); // ✅ 안정성 개선
        router.push(`/answer?questionId=${data.questionId}`);
      } else {
        throw new Error(data?.message || data?.error || '답변을 받아오는 데 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 요청 실패:', error);
      
      // 현재 시도가 최신 시도인지 확인
      if (currentAttempt !== submitAttemptCount.current) return;
      
      setErrorMessage(error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.');
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
      <main className="relative min-h-screen w-full max-w-[460px] flex flex-col justify-start items-center bg-white px-6 py-10">
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

        {errorMessage && (
          <div className="w-full bg-red-50 border border-red-200 p-3 rounded-lg mb-4 text-sm text-red-600">
            <p className="flex items-center">
              <span className="mr-2">⚠️</span>
              {errorMessage}
            </p>
            <p className="text-xs mt-1 text-red-500">네트워크 상태를 확인하시고 다시 시도해주세요.</p>
          </div>
        )}

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
