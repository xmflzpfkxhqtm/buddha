'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useAskStore } from '@/stores/askStore';
import { useBookmarkStore } from '@/stores/useBookmarkStore'; // ✅ 추가

// ✅ 인용 경전 추출 함수
function extractScriptureTitles(answer: string): string[] {
  const pattern = /『(.+?)』/g;
  const matches = new Set<string>();
  let match;

  while ((match = pattern.exec(answer)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
}

export default function AnswerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = searchParams.get('questionId');

  const [question, setQuestion] = useState('');
  const [fullAnswer, setFullAnswer] = useState('');
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const { setParentId } = useAskStore();
  const { setBookmark } = useBookmarkStore(); // ✅ 추가

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const answerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!questionId) return;

    const fetchFromSupabase = async () => {
      const { data, error } = await supabase
        .from('temp_answers')
        .select('question, answer')
        .eq('id', questionId)
        .single();

      if (error || !data) {
        console.error('답변 불러오기 실패:', error);
        setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        setDone(true);
        return;
      }

      setQuestion(data.question);
      setFullAnswer(data.answer);
      setDone(true);
    };

    fetchFromSupabase();
  }, [questionId]);

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

  const handleEdit = () => {
    router.push('/ask');
  };

  const handleCapture = async () => {
    if (!answerRef.current) return;
    const canvas = await html2canvas(answerRef.current);
    const dataUrl = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'buddha-answer.png';
    link.click();
  };

  const handleSaveToSupabase = async () => {
    if (!user) {
      alert('로그인이 필요합니다!');
      return;
    }
  
    if (!questionId) {
      alert('질문 ID가 없습니다.');
      return;
    }
  
    const { error } = await supabase
      .from('temp_answers')
      .update({
        is_saved: true,
        saved_at: new Date().toISOString(),
        user_id: user.id, // ✅ 요거 꼭 필요!
      })
      .eq('id', questionId);
  
    if (error) {
      console.error('저장 실패:', error);
      alert('저장 실패! 다시 시도해주세요.');
    } else {
      setSaved(true);
      alert('✅ 부처님의 답변이 보관되었습니다.');
    }
  };
    
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
          <div className="p-4 rounded-xl shadow-xl border font-maruburi border-red mb-6 whitespace-pre-wrap text-base text-black min-h-[160px]">
            {displayedAnswer}
          </div>

     

          <div className="w-full h-12 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
            <p className="pl-2 text-white text-start font-semibold">🪷 나의 물음</p>
          </div>
          <div className="px-4 py-2 rounded-xl font-base whitespace-pre-wrap text-black mt-2">
            「{question}」
          </div>
               {/* ✅ 인용 경전 리스트 표시 */}
               {extractScriptureTitles(fullAnswer).length > 0 && (
            <div className="w-full mt-4">
              <div className="text-sm text-red-dark font-semibold mb-2">📖 인용된 경전</div>
              <ul className="space-y-2">
                {extractScriptureTitles(fullAnswer).map((title, idx) => (
                  <li
                    key={idx}
                    onClick={() => {
                        // 두 가지 시도: 단권 vs 다권
                        const singleVolumeTitle = `${title}_GPT4.1번역`;
                      
                        // 일단 단권으로 북마크하고 scripture 페이지에서 존재 여부 판단
                        // → 필요한 경우 scripture 페이지에서 파일 fallback 로직 처리 가능
                        setBookmark(singleVolumeTitle, 0); // index는 항상 0
                        router.push('/scripture');
                      }}
                                          className="cursor-pointer text-red-dark hover:underline text-sm"
                  >
                    {title} 열람 →
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {done && (
        <div className="w-full flex flex-col space-y-4 mt-8 px-2 mb-16">
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

          <button
            onClick={handleEdit}
            className="w-full py-3 border border-red text-red-dark font-bold rounded-4xl hover:bg-red hover:text-white transition"
          >
            다시 하기
          </button>

          <button
            onClick={() => {
              setQuestion('');
              setParentId(questionId);
              router.push('/ask');
            }}
            className="w-full py-3 border border-red text-red-dark font-bold rounded-4xl hover:bg-red hover:text-white transition"
          >
            더 자세히 여쭙기
          </button>
        </div>
      )}
    </main>
  );
}
