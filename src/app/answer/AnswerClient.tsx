'use client';

export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useAskStore } from '@/stores/askStore';
import { useBookmarkStore } from '@/stores/useBookmarkStore';
import { toPng } from 'html-to-image';

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

/* -------------------------------------------------------------------------- */
/* UTILS                                                                      */
/* -------------------------------------------------------------------------- */
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

type ScriptureMatch = { title: string; volume?: number };

function filterKnownScriptures(answer: string, known: string[]): ScriptureMatch[] {
  const matches: ScriptureMatch[] = [];
  const normTitles = known.map((t) => ({
    raw: t,
    base: t
      .replace(/_GPT\d+(\.\d+)?번역/, '')
      .replace(/_?\d+권/, '')
      .replace(/_/g, '')
      .replace(/\s/g, '')
      .normalize('NFC'),
  }));

  const patterns = [
    /『(.+?)_(\d+)권』/g,
    /『(.+?)』[^『\n\r]*?(\d+)\s*권/g,
    /『(.+?)\s*(\d+)권』/g,
    /『(.+?)』/g,
  ];

  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(answer)) !== null) {
      const inQuote = m[1];
      const vol = parseInt(m[2]);
      const baseInQuote = inQuote.replace(/\(.*?\)/g, '').replace(/\s/g, '').normalize('NFC');

      let best: string | null = null;
      let score = Infinity;
      for (const { raw, base } of normTitles) {
        const s = levenshtein(baseInQuote, base);
        if (s < score) {
          score = s;
          best = raw;
        }
      }
      if (score <= 5 && best) {
        matches.push({ title: best.replace(/_GPT.*$/, '').replace(/_\d+권$/, ''), volume: vol });
      }
    }
  }

  const seen = new Set<string>();
  return matches.filter(({ title, volume }) => {
    const key = `${title}_${volume ?? 'no'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fmtTitle(raw: string, volume?: number) {
  const base = raw.replace(/_GPT\d+(\.\d+)?번역/, '').replace(/_\d+권/, '').replace(/_/g, ' ');
  return volume ? `${base} ${volume}권` : base;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */
export default function AnswerClient() {
  /* router & params */
  const router = useRouter();
  const params = useSearchParams();
  const questionId = params.get('questionId');

  /* state */
  const [question, setQuestion] = useState('');
  const [fullAnswer, setFullAnswer] = useState('');
  const [scriptureTitles, setScriptureTitles] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  /* stores */
  const { setParentId } = useAskStore();
  const { setBookmark } = useBookmarkStore();

  /* refs */
  const answerRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------------- */
  /* DATA FETCH                                                             */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!questionId) return;

    (async () => {
      const { data, error } = await supabase
        .from('temp_answers')
        .select('question, answer')
        .eq('id', questionId)
        .single();

      if (error || !data) {
        setFullAnswer('부처님과의 연결이 원활하지 않습니다. 다시 시도해 주세요.');
        setDone(true);
        return;
      }
      setQuestion(data.question);
      setFullAnswer(data.answer);
      setDone(true);
    })();

    fetch('/api/scripture/list')
      .then((r) => r.json())
      .then((j) => setScriptureTitles(j.titles || []))
      .catch((e) => console.error('경전 리스트 실패', e));
  }, [questionId]);

  /* ---------------------------------------------------------------------- */
  /* SHARE / SAVE HELPERS                                                   */
  /* ---------------------------------------------------------------------- */
  const saveBase64ToFile = async (dataUrl: string, dir: Directory) => {
    const b64 = dataUrl.split(',')[1];
    const name = `buddha_${Date.now()}.png`;
    await Filesystem.writeFile({ path: name, data: b64, directory: dir });
    const { uri } = await Filesystem.getUri({ path: name, directory: dir });
    return uri;
  };

  const shareImage = async () => {
    if (!answerRef.current) return;

    const dataUrl = await toPng(answerRef.current, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#fff',
      style: { padding: '32px', borderRadius: '1rem', boxSizing: 'border-box' },
    });

    /* native */
    if (Capacitor.isNativePlatform()) {
      try {
        const uri = await saveBase64ToFile(dataUrl, Directory.Cache);
        await Share.share({
          title: '마음속 부처님과 나눈 이야기',
          text: '오늘 마음에 닿은 말씀을 함께 나눕니다.',
          files: [uri],
          dialogTitle: '공유하기',
        });
        return;
      } catch (err) {
        console.warn('native share 실패, fallback', err);
      }
    }

    /* web share */
    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.share({
          title: '마음속 부처님과 나눈 이야기',
          text: '오늘 마음에 닿은 말씀을 함께 나눕니다.',
          files: [new File([blob], 'buddha.png', { type: 'image/png' })],
        });
        return;
      } catch {}
    }

    /* fallback: copy url */
    try {
      await navigator.clipboard.writeText(dataUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      alert('URL 복사 실패');
    }
  };

  const saveToGallery = async () => {
    if (!answerRef.current) return;
    try {
      const dataUrl = await toPng(answerRef.current, { quality: 1, pixelRatio: 2 });
      await saveBase64ToFile(dataUrl, Directory.ExternalStorage); // Android Pictures/
      alert('✅ 갤러리에 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장 실패');
    }
  };

  const saveAnswerRecord = async () => {
    if (!user) return alert('로그인이 필요합니다!');
    if (!questionId) return alert('질문 ID가 없습니다.');

    const { error } = await supabase
      .from('temp_answers')
      .update({ is_saved: true, saved_at: new Date().toISOString(), user_id: user.id })
      .eq('id', questionId);

    if (error) {
      alert('저장 실패! 다시 시도해주세요.');
    } else {
      setSaved(true);
      alert('✅ 보관되었습니다.');
    }
  };

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                 */
  /* ---------------------------------------------------------------------- */
  const formatted = fullAnswer.replace(/『(.+?)』/g, (_, p1) => {
    const raw = scriptureTitles.find((t) => t.startsWith(p1)) || p1;
    return `『${fmtTitle(raw)}』`;
  });

  const refs = filterKnownScriptures(fullAnswer, scriptureTitles);
  const dedup = new Set<string>();

  return (
    <main className="relative min-h-screen w-full max-w-[460px] flex flex-col items-center mx-auto bg-white px-6 py-10">
      {/* 카드 본문 */}
      <div ref={answerRef} className="rounded-2xl px-2">
        <h2 className="text-2xl text-red font-semibold mt-4">
          부처님이라면 분명<br />이렇게 말씀하셨을 것입니다
        </h2>

        {/* 답변 */}
        <section className="mt-6">
          <header className="h-12 bg-red-light rounded-xl flex items-center pl-3 text-white font-semibold">
            🪷 이르시길
          </header>
          <div className="p-4 mt-4 rounded-xl shadow-xl border font-maruburi border-red whitespace-pre-wrap text-base text-black">
            {formatted}
          </div>
        </section>

        {/* 질문 */}
        <section className="mt-8">
          <header className="h-12 bg-red-light rounded-xl flex items-center pl-3 text-white font-semibold">
            🪷 나의 물음
          </header>
          <div className="p-4 mt-4 rounded-xl shadow-xl border border-red whitespace-pre-wrap text-base text-black">
            {question}
          </div>
        </section>

        {/* 인용 경전 */}
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
                    ? scriptureTitles.find((t) =>
                        new RegExp(`^${title}[_ ]?${volume}권`).test(t)
                      )
                    : scriptureTitles.find((t) => t === title) ||
                      scriptureTitles.find((t) => t.startsWith(title));
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

      {/* 액션 버튼 */}
      {done && (
        <div className="w-full flex flex-col space-y-4 mt-12 mb-12 px-2">
          <div className="flex space-x-4">
            <button
              onClick={shareImage}
              className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red hover:text-white transition"
            >
              이미지로 공유하기
            </button>
            <button
              onClick={saveToGallery}
              className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red hover:text-white transition"
            >
              갤러리에 저장하기
            </button>
          </div>

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

          <button
            onClick={() => router.push('/ask')}
            className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition"
          >
            새로운 문답을 시작합니다
          </button>

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

      {/* URL 복사 모달 */}
      {showCopied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-full shadow-md z-50">
          ✅ 주소가 복사되었습니다
        </div>
      )}
    </main>
  );
}
