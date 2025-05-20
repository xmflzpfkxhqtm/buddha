/******************************************************
 *  AnswerClient.tsx
 *  iOS / Android: Capacitor Share 로 URL 공유
 *  (화면 캡처·갤러리 저장 기능 제거)
 *****************************************************/
'use client';

export const dynamic = 'force-dynamic';

/* ----------------------------- 외부 라이브러리 ----------------------------- */
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Capacitor } from '@capacitor/core';
import { Share }     from '@capacitor/share';

import { supabase }                from '@/lib/supabaseClient';
import type { User }               from '@supabase/supabase-js';
import { useAskStore }             from '@/stores/askStore';
import { useBookmarkStore }        from '@/stores/useBookmarkStore';

/* -------------------- 문자열 유사도 + 경전 제목 매칭 ----------------------- */
function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

type ScriptureMatch = { title: string; volume?: number };

function filterKnownScriptures(answer: string, known: string[]) {
  const norm = known.map(t => ({
    raw : t,
    base: t
      .replace(/_GPT\d+(\.\d+)?번역/, '')
      .replace(/_?\d+권/, '')
      .replace(/_/g , '')
      .replace(/\s/g, '')
      .normalize('NFC'),
  }));

  const patterns = [
    /『(.+?)_(\d+)권』/g,
    /『(.+?)』[^『\n\r]*?(\d+)\s*권/g,
    /『(.+?)\s*(\d+)권』/g,
    /『(.+?)』/g,
  ];

  const matches: ScriptureMatch[] = [];

  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(answer)) !== null) {
      const [, inQuote, volStr] = m;
      const vol = parseInt(volStr);
      const baseInQuote = inQuote.replace(/\(.*?\)/g, '').replace(/\s/g, '').normalize('NFC');

      let best: string | null = null;
      let bestScore = Infinity;
      for (const { raw, base } of norm) {
        const s = levenshtein(baseInQuote, base);
        if (s < bestScore) {
          bestScore = s;
          best      = raw;
        }
      }
      if (bestScore <= 5 && best) {
        matches.push({
          title : best.replace(/_GPT.*$/, '').replace(/_\d+권$/, ''),
          volume: vol,
        });
      }
    }
  }

  /* 중복 제거 */
  const seen = new Set<string>();
  return matches.filter(({ title, volume }) => {
    const key = `${title}_${volume ?? 'no'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const fmtTitle = (raw: string, volume?: number) =>
  raw
    .replace(/_GPT\d+(\.\d+)?번역/, '')
    .replace(/_\d+권/, '')
    .replace(/_/g, ' ') + (volume ? ` ${volume}권` : '');

/* -------------------------------------------------------------------------- */
/*                                  COMPONENT                                 */
/* -------------------------------------------------------------------------- */
export default function AnswerClient() {
  /* ------- Router & Query Param ---------------------------------------- */
  const router      = useRouter();
  const params      = useSearchParams();
  const questionId  = params.get('questionId');

  /* ------- Global State ------------------------------------------------ */
  const { setParentId } = useAskStore();
  const { setBookmark } = useBookmarkStore();

  /* ------- Local State ------------------------------------------------- */
  const [question        , setQuestion]        = useState('');
  const [fullAnswer      , setFullAnswer]      = useState('');
  const [scriptureTitles , setScriptureTitles] = useState<string[]>([]);
  const [done            , setDone]            = useState(false);

  const [user            , setUser]           = useState<User | null>(null);
  const [saved           , setSaved]          = useState(false);
  const [showCopied      , setShowCopied]     = useState(false);

  /* ----------------------- Supabase & 데이터 로딩 ----------------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!questionId) return;

    /* 질문 + 답변 로드 */
    supabase
      .from('temp_answers')
      .select('question, answer')
      .eq('id', questionId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        } else {
          setQuestion(data.question);
          setFullAnswer(data.answer);
        }
        setDone(true);
      });

    /* 경전 제목 리스트 로드 */
    fetch('/api/scripture/list')
      .then(r => r.json())
      .then(j => setScriptureTitles(j.titles || []));
  }, [questionId]);

  /* -------------------------- URL 공유 ------------------------------ */
  const shareUrl = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;

    // 네이티브 (Capacitor)
    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: '마음속 부처님과 나눈 이야기',
        text : '오늘 마음에 닿은 말씀을 함께 나눕니다.',
        url,
      });
      return;
    }

    // Web Share API
    if (navigator.share) {
      await navigator.share({
        title: '마음속 부처님과 나눈 이야기',
        text : '오늘 마음에 닿은 말씀을 함께 나눕니다.',
        url,
      });
      return;
    }

    // Fallback: 클립보드 복사
    await navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  /* -------------------- 답변 기록을 Supabase 에 보관 -------------------- */
  const saveAnswerRecord = async () => {
    if (!user) return alert('로그인이 필요합니다!');
    if (!questionId) return;

    const { error } = await supabase
      .from('temp_answers')
      .update({ is_saved: true, saved_at: new Date().toISOString(), user_id: user.id })
      .eq('id', questionId);

    if (error) alert('저장 실패! 다시 시도해주세요.');
    else {
      setSaved(true);
      alert('✅ 보관되었습니다.');
    }
  };

  /* -------------------- UI 렌더 ---------------------------------------- */
  const formatted = fullAnswer.replace(/『(.+?)』/g, (_, p1) => {
    const raw = scriptureTitles.find(t => t.startsWith(p1)) || p1;
    return `『${fmtTitle(raw)}』`;
  });

  const refs  = filterKnownScriptures(fullAnswer, scriptureTitles);
  const dedup = new Set<string>();

  return (
    <main className="relative min-h-screen w-full max-w-[460px] flex flex-col items-center mx-auto bg-white px-6 py-6">
      {/* ======================== 카드 영역 ======================== */}
      <div className="rounded-2xl px-2">
        <h2 className="text-2xl text-red font-semibold">
          부처님이라면 분명<br />이렇게 말씀하셨을 것입니다
        </h2>
      {/* ----------- 질문 ----------- */}
      <section className="mt-8">
          <header className="rounded-xl flex items-center text-red font-semibold">
            나의 질문은
          </header>
          <div className="py-2 whitespace-pre-wrap break-words overflow-x-auto rounded-xl border-red whitespace-pre-wrap text-base text-black">
            {question}
          </div>
        </section>


        {/* ----------- 답변 ----------- */}
        <section className="mt-10">
          <header className="h-12 bg-red-light rounded-xl flex items-center pl-3 text-white font-semibold">
            🪷 이르시길
          </header>
          <div className="p-4 mt-4 rounded-xl shadow-xl border font-maruburi border-red whitespace-pre-wrap break-words text-base text-black">
          {formatted}
          </div>
        </section>

  

        {/* ----------- 인용 경전 ----------- */}
        {refs.length > 0 && (
          <section className="my-12">
            <p className="text-sm text-red-dark font-semibold mb-2">📖 인용된 경전</p>
            <ul className="space-y-2">
              {refs.map(({ title, volume }, i) => {
                const key = `${title}_${volume ?? 'no'}`;
                if (dedup.has(key)) return null;
                dedup.add(key);

                const match =
                  volume
                    ? scriptureTitles.find(t => new RegExp(`^${title}[_ ]?${volume}권`).test(t))
                    : scriptureTitles.find(t => t === title) ||
                     // startsWith 된 것들 중 **권수 오름차순**으로 골라서 첫 번째
                     scriptureTitles
                       .filter(t => t.startsWith(title))
                      .sort((a, b) => {
                        const va = parseInt(a.match(/(\d+)권/)?.[1] ?? '0', 10);
                              const vb = parseInt(b.match(/(\d+)권/)?.[1] ?? '0', 10);
                              return va - vb;               // 1권, 2권 … 10권
                            })[0];
                    
                if (!match) return null;

                return (
                  <li
                    key={i}
                    onClick={() => {
                      setBookmark(match, 0);
                      router.push('/scripture');
                    }}
                    className="cursor-pointer text-red-dark hover:underline text-sm"
                  >
                    {fmtTitle(match, volume)} 열람 →
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* ======================== 액션 버튼 ======================== */}
      {done && (
        <div className="w-full flex flex-col space-y-4 mt-12 mb-12 px-2">
          {/* 1행: 공유하기 / 보관하기 */}
          <div className="flex space-x-4">
            <button
              onClick={shareUrl}
              className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red hover:text-white transition"
            >
              공유하기
            </button>
            <button
              onClick={saveAnswerRecord}
              disabled={saved}
              className={`w-full py-3 font-bold rounded-4xl transition ${
                saved
                  ? 'bg-red text-white cursor-not-allowed'
                  : 'bg-white text-red-dark border border-red hover:bg-red hover:text-white'
              }`}
            >
              {saved ? '✔︎ 보관됨' : '보관하기'}
            </button>
          </div>

          {/* 2행: 새로운 문답 */}
          <button
            onClick={() => router.push('/ask')}
            className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition"
          >
            새로운 문답을 시작합니다
          </button>

          {/* 3행: 문답 이어가기 */}
          <button
            onClick={() => {
              setQuestion('');
              setParentId(questionId);
              router.push('/ask');
            }}
            className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition"
          >
            문답을 이어갑니다
          </button>
        </div>
      )}

      {/* ---------------- Toast (URL 복사) ---------------- */}
      {showCopied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-full shadow-md z-50">
          ✅ 주소가 복사되었습니다
        </div>
      )}
    </main>
  );
}
