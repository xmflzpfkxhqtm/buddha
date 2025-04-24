'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useAskStore } from '@/stores/askStore';
import { useBookmarkStore } from '@/stores/useBookmarkStore';

function filterKnownScriptures(answer: string, knownTitles: string[]): string[] {
  const pattern = /『(.+?)』/g;
  const matches = new Set<string>();
  let match;

  const normalizedTitles = knownTitles.map((t) => ({
    raw: t,
    normalized: t
      .replace(/_GPT\d+(\.\d+)?번역/, '') // GPT 버전 제거
      .replace(/_/g, '')                  // 언더스코어 제거
      .replace(/\s/g, '')                 // 공백 제거
      .normalize('NFC'),
  }));

  while ((match = pattern.exec(answer)) !== null) {
    const rawInQuote = match[1].split(/[\s_]/)[0]  // 『현양성교론 제1권』 → 현양성교론
      .replace(/\s/g, '')
      .normalize('NFC');

    const found = normalizedTitles.find(({ normalized }) =>
      normalized.startsWith(rawInQuote)
    );

    if (found) {
      matches.add(found.raw); // 실제 파일명 추가
    }
  }

  return Array.from(matches);
}

function formatDisplayTitle(rawTitle: string): string {
  return rawTitle
    .replace(/_GPT\d+(\.\d+)?번역/, '')
    .replace(/_/g, ' ');
}

export default function AnswerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = searchParams.get('questionId');
  const [showCopiedModal, setShowCopiedModal] = useState(false);

  const [question, setQuestion] = useState('');
  const [fullAnswer, setFullAnswer] = useState('');
  
  const [scriptureTitles, setScriptureTitles] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const { setParentId } = useAskStore();
  const { setBookmark } = useBookmarkStore();

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

    const fetchScriptureList = async () => {
      try {
        const res = await fetch('/api/scripture/list');
        const json = await res.json();
        setScriptureTitles(json.titles || []);
      } catch (e) {
        console.error('경전 리스트 불러오기 실패:', e);
      }
    };

    fetchFromSupabase();
    fetchScriptureList();
  }, [questionId]);

  const handleEdit = () => {
    router.push('/ask');
  };
  const formattedAnswer = fullAnswer.replace(/『(.+?)』/g, (match, p1) => {
    const matchedRaw = scriptureTitles.find((t) => t.startsWith(p1)) || p1;
    const display = formatDisplayTitle(matchedRaw);
    return `『${display}』`;
  });
  
  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '마음속 부처님과 나눈 이야기',
          text: '내 질문에 돌아온 부처님의 가르침입니다. 오늘 마음에 닿은 말씀을 함께 나눕니다.',
          url,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShowCopiedModal(true);
        setTimeout(() => setShowCopiedModal(false), 2000);
      } catch {
        alert('클립보드 복사에 실패했습니다.');
      }
    }
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
        user_id: user.id,
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

  const validScriptureTitles = filterKnownScriptures(fullAnswer, scriptureTitles);

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-white px-6 py-10">
      <div ref={answerRef} className="rounded-2xl px-2">
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
            {formattedAnswer}
          </div>

          <div className="w-full h-12 bg-red-light rounded-xl flex flex-row items-center mt-6 pl-1 justify-start">
            <p className="pl-2 text-white text-start font-semibold">🪷 나의 물음</p>
          </div>
          <div className="p-4 rounded-xl mt-4 shadow-xl border border-red mb-6 whitespace-pre-wrap text-base text-black min-h-[160px]">
            {question}
          </div>

          {validScriptureTitles.length > 0 && (
            <div className="w-full my-12">
              <div className="text-sm text-red-dark font-semibold mb-2">📖 인용된 경전</div>
              <ul className="space-y-2">
                {validScriptureTitles.map((title, idx) => {
                  const formattedTitle = scriptureTitles.find((t) =>
                    t.startsWith(title) && t.includes('GPT4.1번역')
                  ) || `${title}_GPT4.1번역`;
                  return (
                    <li
                      key={idx}
                      onClick={() => {
                        setBookmark(formattedTitle, 0);
                        router.push('/scripture');
                      }}
                      className="cursor-pointer text-red-dark hover:underline text-sm"
                    >
                      {formatDisplayTitle(formattedTitle)} 열람 →
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {done && (
        <div className="w-full flex flex-col space-y-4 mt-12 px-2 mb-12">
          <div className="flex flex-row space-x-4">
            <button
              onClick={handleShare}
              className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red transition hover:text-white"
            >
              공유하기
            </button>
            <button
              onClick={handleSaveToSupabase}
              disabled={saved}
              className={`w-full py-3 font-bold rounded-4xl transition ${
                saved
                  ? 'bg-red text-white cursor-not-allowed'
                  : 'bg-white text-red-dark border border-red hover:text-white hover:bg-red'
              }`}
            >
              {saved ? '✔︎ 보관됨' : '보관하기'}
            </button>
          </div>

          <button
            onClick={handleEdit}
            className="w-full py-3 border bg-red-light border-red text-white font-bold rounded-4xl hover:bg-red hover:text-red=darl transition"
          >
            새로운 문답을 시작합니다
          </button>

          <button
            onClick={() => {
              setQuestion('');
              setParentId(questionId);
              router.push('/ask');
            }}
            className="w-full py-3 border bg-red-light border-red text-white font-bold rounded-4xl hover:bg-red hover:text-red=darl transition"
          >
            문답을 이어갑니다
          </button>
        </div>
      )}

      {showCopiedModal && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-full shadow-md z-50 transition">
          ✅ 주소가 복사되었습니다
        </div>
      )}
    </main>
  );
}
