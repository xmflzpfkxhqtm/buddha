'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { copyTexts } from '@/data/copyTexts';
import TracingCanvas from '../../../../components/TracingCanvas';
import { saveStroke, getStroke, deleteStroke, clearSession } from '@/lib/copyStore';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';          // ★ ① 추가

const WINDOW  = 7;   // 한 줄 7칸
const CURCOL  = 3;   // 중앙(4번째) 칸

export default function CopySession() {
  /* ───── 라우팅 & 기초 변수 */
  const { id }   = useParams();
  const search   = useSearchParams();
  const router   = useRouter();

  const [idx,        setIdx]        = useState(0);                     // 현재 chars 상의 인덱스
  const [guide,      setGuide]      = useState<string[]>(Array(WINDOW).fill(''));
  const [prevSvgs,   setPrevSvgs]   = useState<(string | null)[]>(Array(WINDOW).fill(null));
  const [currentSvg, setCurrentSvg] = useState<string | null>(null);

  const isIdString = typeof id === 'string';
  const sessionId  = isIdString ? (id as string) : '';
  const textObj    = isIdString ? copyTexts.find(t => t.id === sessionId) : null;
  const lang: 'han' | 'kor' = (search.get('lang') as 'kor' | 'han') ?? 'han';
  const chars = textObj ? [...textObj[lang]] : [];

  /* ★ 공백(띄어쓰기)인지 판단하는 헬퍼 */
  const isSkippable = (c: string) => lang === 'kor' && c === ' ';

  /* ★ 이전/다음 ‘실제 글자’ 위치를 찾는 헬퍼 */
  const findNext = (i: number) => {
    let k = i + 1;
    while (k < chars.length && isSkippable(chars[k])) k++;
    return k;
  };
  const findPrev = (i: number) => {
    let k = i - 1;
    while (k >= 0 && isSkippable(chars[k])) k--;
    return k;
  };

/* ───────── 최초 이어쓰기 위치 찾기 (진행도 or 0) ───────── */
useEffect(() => {
    if (!isIdString || !textObj) return;
  
    (async () => {
      let start = 0;
  
      /* 1) 로그인 유저 확인 */
      const { data: { user } } = await supabase.auth.getUser();
  
      if (user) {
        /* 2) copy_notes 에 진행도 row 있는지 조회 */
        const { data: note } = await supabase
          .from('copy_notes')
          .select('progress_idx')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .eq('lang', lang)                 // ← 언어까지 동일한 행
          .single();
  
        if (note) {
          start = Math.min(note.progress_idx ?? 0, chars.length - 1);
        } else {
          /* 3) 진행도 row가 없으면 로컬 찌꺼기 삭제 */
          await clearSession(sessionId);
        }
      } else {
        /* (비로그인) 그냥 찌꺼기 삭제 */
        await clearSession(sessionId);
      }
  
      /* 4) 시작 위치로 윈도 로드 */
      await loadWindow(start);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isIdString, textObj, lang]);
  
  /* ───────── 현재 idx를 네 번째 칸에 맞춘 7칸 윈도 계산 */
  const loadWindow = async (start: number) => {
    if (!textObj) return;
    if (start >= chars.length) return;

    /* ★ 캔버스에 올릴 글자가 공백이면 자동 스킵 → 다음 글자로 재귀 */
    let i = start;
    while (i < chars.length && isSkippable(chars[i])) i++;
    if (i !== start) {
      await loadWindow(i);
      return;
    }

    const g: string[]             = [];
    const p: (string | null)[]    = [];

    for (let col = 0; col < WINDOW; col++) {
      const gi = i - CURCOL + col;
      g.push(gi >= 0 && gi < chars.length ? chars[gi] : '');
      p.push(
        gi >= 0 && gi < i
          ? (await getStroke(sessionId, gi)) ?? null
          : null
      );
    }
    setGuide(g);
    setPrevSvgs(p);
    setCurrentSvg((await getStroke(sessionId, i)) ?? null);
    setIdx(i);
  };

  /* ───────── 글자 하나 완료 → 다음 글자 자동 이동 */
  const handleDone = async (svg: string) => {
    if (!textObj) return;
    await saveStroke(sessionId, idx, svg);
    setPrevSvgs(prev => {
      const copy = [...prev];
      copy[CURCOL] = svg;
      return copy;
    });
    const next = findNext(idx);            // ★ 공백 건너뛴 다음 글자
    if (next < chars.length) loadWindow(next);
  };

  const handleClear = async () => {
    if (!textObj) return;
    await deleteStroke(sessionId, idx);
    setCurrentSvg(null);
    setPrevSvgs(prev => {
      const copy = [...prev];
      copy[CURCOL] = null;
      return copy;
    });
  };

  /* ───────── "중간 저장" — 이미 저장된 글자 + 현재 글자 저장 */
  const handleMidSave = async () => {
    if (!textObj) return;
    if (currentSvg) await saveStroke(sessionId, idx, currentSvg);

        /* ---------- ② 진행도 copy_notes upsert ---------- */
   // 다음에 쓸 글자(공백 스킵 포함). currentSvg 없으면 그대로 idx
  const nextIdx = currentSvg ? findNext(idx) : idx;
  // • user_id 는 JS에서 가져오면 충돌키(onConflict)에 포함 가능
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  const { error } = await supabase
    .from('copy_notes')
    .upsert(
      {
        user_id     : user.id,
        session_id  : sessionId,
        title       : textObj.title,
        progress_idx: nextIdx,     // 0-base
        completed   : false,
        lang : lang
      },
      { onConflict: 'session_id,user_id' }
    );

    if (error) {
      console.error(error);
      alert('❌ 중간 저장 실패');
      return;
    }


    alert('중간 저장 완료!');
  };

  const handleReset = async () => {
    if (!textObj) return;
    if (confirm('모든 글자를 삭제하고 처음부터 다시 시작할까요?')) {
      await clearSession(sessionId);
      await loadWindow(0);
    }
  };

  const gotoComplete = () => router.push(`/copy/${sessionId}/complete`);

  const isFinished = idx + 1 >= chars.length && currentSvg;

  /* ───────── 렌더링 */
  if (!isIdString) return null;
  if (!textObj)    return <p>잘못된 경전 ID입니다.</p>;

  return (
    <main className="flex flex-col max-w-[460px] items-center p- select-none touch-none">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.push('/copy')}
        className="self-start mb-2 flex items-center gap-1 text-gray-600 hover:text-black"
      >
        <ArrowLeft size={20} className="text-red-dark" />
        <span className="text-base text-red-dark">뒤로가기</span>
      </button>

      {/* 제목 & 진행도 */}
      <div className="w-full h-16 bg-red-light rounded-xl flex flex-row items-center my-4 pl-1">
        <Image
          src="/lotusbeige.png"
          alt="lotus"
          width={48}
          height={48}
          className="object-contain border-beige mx-2"
        />
        <div className="flex flex-col">
          <div className="flex flex-row items-baseline">
            <h2 className="text-2xl text-beige">
              <span className="font-semibold">{textObj.title}</span>
            </h2>
            <p className="px-4 text-sm text-beige">
              {idx + 1}/{chars.length}
            </p>
          </div>
          <span className="text-sm text-beige">엄청난 효험이 있습니다</span>
        </div>
      </div>

      {/* 글자 쓰기 */}
      <TracingCanvas
        char={chars[idx]}                 // ← 공백이 오지 않도록 loadWindow가 보장
        lang={lang}
        initialSvg={currentSvg}
        guideChars={guide}
        prevSvgs={prevSvgs}
        onFinish={handleDone}
        onClear={handleClear}
        onPrev={() => loadWindow(findPrev(idx))}   /* ★ */
        onNext={() => loadWindow(findNext(idx))}   /* ★ */
        canPrev={findPrev(idx) >= 0}               /* ★ */
        canNext={currentSvg !== null && findNext(idx) < chars.length} /* ★ */
      />

      {/* 리셋 · 중간저장 */}
      <div className="w-full flex flex-row space-x-4 my-4">
        <button
          onClick={handleReset}
          className="w-full px-4 py-2 font-bold border border-red bg-white text-red-dark rounded-xl hover:bg-red hover:text-white transition"
        >
          전체 리셋
        </button>
        <button
          onClick={handleMidSave}
          className="w-full px-4 py-2 font-bold border bg-red-light text-white rounded-xl hover:bg-red hover:text-white transition"
        >
          중간 저장
        </button>
      </div>

      {/* 완성본 보기 */}
      <div className="w-full my-4">
        <button
          onClick={gotoComplete}
          disabled={!isFinished}
          className={`w-full px-4 py-2 font-bold rounded-xl transition ${
            isFinished
              ? 'border border-red-light bg-red-light text-white hover:bg-red'
              : 'border border-gray-300 text-gray-400 cursor-not-allowed'
          }`}
        >
          완성본 보기
        </button>
      </div>
    </main>
  );
}
