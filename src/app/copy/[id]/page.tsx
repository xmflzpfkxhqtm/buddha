// src/app/copy/[id]/page.tsx
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { copyTexts } from '@/data/copyTexts';
import TracingCanvas from '../../../../components/TracingCanvas';
import { saveStroke, getStroke, deleteStroke, clearSession } from '@/lib/copyStore';
import Image from 'next/image';
const WINDOW = 7;
const CURCOL = 3;

export default function CopySession() {
    /* ───── 라우팅 */
    const { id }      = useParams();
    const search      = useSearchParams();
    const router      = useRouter();
    
    // Move hooks to the top, before any return
    const [idx, setIdx]                 = useState(0);
    const [guide, setGuide]             = useState<string[]>(Array(WINDOW).fill(''));
    const [prevSvgs, setPrevSvgs]       = useState<(string | null)[]>(Array(WINDOW).fill(null));
    const [currentSvg, setCurrentSvg]   = useState<string | null>(null);

    // Conditional rendering for error cases
    if (typeof id !== 'string') return null;
    const textObj = copyTexts.find(t => t.id === id);
    if (!textObj) return <p>잘못된 경전 ID입니다.</p>;

    /* ───── 언어: URL 파라미터 → 기본 'han' */
    const lang: 'han' | 'kor' = (search.get('lang') as 'kor' | 'han') ?? 'han';
  
    /* 본문 글자 배열 */
    const chars = [...textObj[lang]];

    /* ───────── 최초 이어쓰기 위치 찾기 */
    useEffect(() => {
      (async () => {
        let i = 0;
        while (i < chars.length && (await getStroke(id, i))) i++;
        await loadWindow(i);
      })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /* ───────── 현재 idx를 네 번째 칸에 맞춘 7칸 윈도 계산 */
    const loadWindow = async (i: number) => {
      if (i < 0 || i >= chars.length) return;

      const g: string[]               = [];
      const p: (string | null)[]      = [];
      for (let col = 0; col < WINDOW; col++) {
        const gi = i - CURCOL + col;
        g.push(gi >= 0 && gi < chars.length ? chars[gi] : '');
        p.push(gi >= 0 && gi < i ? (await getStroke(id, gi)) ?? null : null);
      }
      setGuide(g);
      setPrevSvgs(p);
      setCurrentSvg((await getStroke(id, i)) ?? null);
      setIdx(i);
    };

    /* ───────── 글자 하나 완료 → 다음 글자 자동 이동 */
    const handleDone = async (svg: string) => {
      await saveStroke(id, idx, svg);
      setPrevSvgs(prev => {
        const copy = [...prev];
        copy[CURCOL] = svg;
        return copy;
      });
      if (idx + 1 < chars.length) loadWindow(idx + 1);
    };

    const handleClear = async () => {
      await deleteStroke(id, idx);
      setCurrentSvg(null);
      setPrevSvgs(prev => {
        const copy = [...prev];
        copy[CURCOL] = null;
        return copy;
      });
    };

    /* ───────── "중간 저장" — 이미 저장된 글자 + 현재 글자 저장 */
    const handleMidSave = async () => {
      if (currentSvg) await saveStroke(id, idx, currentSvg);
      alert('중간 저장 완료!');
    };

    const handleReset = async () => {
      if (confirm('모든 글자를 삭제하고 처음부터 다시 시작할까요?')) {
        await clearSession(id);
        await loadWindow(0);
      }
    };

    const gotoComplete = () => router.push(`/copy/${id}/complete`);

    const isFinished = idx + 1 >= chars.length && currentSvg;

    return (
      <main className="flex flex-col max-w-[460px] items-center p-4">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/copy')}
          className="self-start mb-2 flex items-center gap-1 text-gray-600 hover:text-black"
        >
          <ArrowLeft size={20} className="text-red-dark" />
          <span className="text-base text-red-dark">뒤로가기</span>
        </button>
        <div className="w-full h-16 bg-red-light rounded-xl flex flex-row items-center my-4 pl-1 justify-start">
            <Image src="/lotusbeige.png" alt="lotus" width={48} height={48} className="object-contain border-beige mx-2" />
            <div className="flex flex-col">
              <div className="flex flex-row items-baseline">          
              <h2 className="text-2xl text-beige">
    <span className="font-semibold">{textObj.title}</span>
  </h2>
        <p className="px-4 text-sm text-beige">{idx + 1}/{chars.length}</p>
        </div>
        <span className="text-sm text-beige">엄청난 효험이 있습니다</span>
  </div>

            </div>

        {/* 글자 쓰기 */}
        <TracingCanvas
          char={chars[idx]}
          lang={lang}                         // ★ 추가

          initialSvg={currentSvg}
          guideChars={guide}
          prevSvgs={prevSvgs}
          onFinish={handleDone}
          onClear={handleClear}
          onPrev={() => loadWindow(idx - 1)}
          onNext={() => loadWindow(idx + 1)}
          canPrev={idx > 0}
          canNext={currentSvg !== null && idx + 1 < chars.length} 
          />

        {/* 리셋 · 중간저장 · 완성본 */}
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
        <div className="w-full my-4">
          <button
            onClick={gotoComplete}
            disabled={!isFinished}
            className={`w-full px-4 py-2 font-bold rounded-xl transition ${
              isFinished
                ? 'w-full border border-red-light bg-red-light text-white hover:bg-red hover:text-white'
                : 'w-full border border-gray-300 text-gray-400 cursor-not-allowed'
            }`}
          >
            완성본 보기
          </button>
          </div>
      </main>
    );
}
