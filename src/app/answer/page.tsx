'use client';

import { useRouter } from 'next/navigation';
import { useAskStore } from '../../stores/askStore';
import { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabaseClient';
import Loading from '../../../components/Loading';
import type { User } from '@supabase/supabase-js';

export default function AnswerPage() {
  const router = useRouter();
  const { question, selectedModel } = useAskStore();
  const [fullAnswer, setFullAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [done, setDone] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  type MyUser = User & { user_metadata?: { full_name?: string; [key: string]: any } };
  const [user, setUser] = useState<MyUser | null>(null);
    const [saved, setSaved] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const answerRef = useRef(null);

  // 로그인 유저 가져오기
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // GPT 호출
  useEffect(() => {
    if (!question || !selectedModel) return;

    const fetchAnswer = async () => {
      try {
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, model: selectedModel }),
        });

        if (!response.ok) throw new Error('응답 실패');

        const data = await response.json();

        if (data && data.answer) {
          setFullAnswer(data.answer);
        } else {
          throw new Error('응답 데이터가 올바르지 않습니다');
        }

        setDone(true);
      } catch (error) {
        console.error('API 호출 실패:', error);
        setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        setDone(true);
      }
    };

    fetchAnswer();
  }, [question, selectedModel]);

  // 타자 효과
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

  // 로딩 페이드아웃
  useEffect(() => {
    if (fullAnswer) {
      setFadeOut(true);
      const timeout = setTimeout(() => {
        setShowLoading(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [fullAnswer]);

  // 질문 수정
  const handleEdit = () => {
    router.push('/ask');
  };

  // 이미지 저장
  const handleCapture = async () => {
    if (!answerRef.current) return;
    const canvas = await html2canvas(answerRef.current);
    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'buddha-answer.png';
    link.click();
  };

  // Supabase에 질문 + 답변 저장
  const handleSaveToSupabase = async () => {
    if (!user) {
      alert('로그인이 필요합니다!');
      return;
    }
    console.log('Saving to Supabase:', {
      user_id: user?.id,
      question,
      answer: fullAnswer,
    });
    const { error } = await supabase.from('answers').insert([
      {
        user_id: user.id,
        question,
        answer: fullAnswer,
      },
    ]);

    if (error) {
      console.error('저장 실패:', error);
      alert('저장 실패! 다시 시도해주세요.');
    } else {
      setSaved(true);
      alert('✅ 부처님의 답변이 보관되었습니다.');
    }
  };

  if (showLoading) return <Loading fadeOut={fadeOut} />;

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
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
            「{question}」
          </div>
        </div>
      </div>

      {done && (
        <div className="w-full flex flex-col space-y-4 mt-8 px-2 mb-16">
          {/* 1st row: 다시하기 */}
          <div className="flex flex-row space-x-4">

          <button
              onClick={handleCapture}
              className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition"
            >
              캡처하기
            </button>
            <button
              onClick={handleSaveToSupabase}
              disabled={saved}
              className={`w-full py-3 font-bold rounded-4xl transition ${
                saved
                  ? 'bg-red text-white cursor-not-allowed'
                  : 'bg-red-light text-white hover:bg-red'
              }`}
            >
              {saved ? '✅ 보관됨' : '보관하기'}
            </button>
            </div>

          {/* 2nd row: 캡쳐 + 저장 */}
          <button
            onClick={handleEdit}
            className="w-full py-3 border border-red text-red-dark font-bold rounded-4xl hover:bg-red hover:text-white transition"
          >
            다시 하기
          </button>
        </div>
      )}

   
    </main>
  );
}
