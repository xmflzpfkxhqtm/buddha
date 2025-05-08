'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { copyTexts } from '@/data/copyTexts';
import TracingCanvas from '../../../../components/TracingCanvas';
import { saveStroke, getStroke, deleteStroke, clearSession } from '@/lib/copyStore';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

const WINDOW = 7;   // 한 줄 7칸1
const CURCOL = 3;   // 중앙(4번째) 칸

export default function CopySession() {
  /* ───────── 기본 변수 ───────── */
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
   const search = useSearchParams();
  const resume = search.get('resume') === '1';   // 수정하기로 왔는지?


  const textObj = copyTexts.find(t => t.id === id);
  const lang: 'han' | 'kor' = textObj?.lang ?? 'han';
  const chars = textObj ? [...textObj.text] : [];

  /* ───────── 상태 ───────── */
  const [idx,        setIdx]        = useState(0);                     // 현재 인덱스
  const [guide,      setGuide]      = useState<string[]>(Array(WINDOW).fill(''));
  const [prevSvgs,   setPrevSvgs]   = useState<(string | null)[]>(Array(WINDOW).fill(null));
   const [currentSvg, setCurrentSvg] = useState<string | null>(null);
   const [strokesDone, setStrokesDone] = useState<boolean[]>([]);   // ← 추가
  
  /* ───────── 유틸 ───────── */
  const isSkippable = (c: string) => lang === 'kor' && c === ' ';
  const findNext = (i: number) => { let k=i+1; while(k<chars.length&&isSkippable(chars[k])) k++; return k; };
  const findPrev = (i: number) => { let k=i-1; while(k>=0&&isSkippable(chars[k])) k--; return k; };

  /* ───────── 최초 위치 결정 ───────── */
  useEffect(() => {
    if (!id || !textObj) return;

    (async () => {
      let start = 0;

      /* 진행도 확인 */
      const { data:{ user } } = await supabase.auth.getUser();
      if (user) {
        const { data: note } = await supabase
          .from('copy_progress')
          .select('progress_idx, completed')
          .eq('user_id', user.id)
          .eq('session_id', id)
          .eq('lang', lang)
          .single();

        if (note) {
          if (note.completed && !resume) {
            await clearSession(id);
            start = 0;
          } else {
            start = Math.min(note.progress_idx ?? 0, chars.length - 1);
          }
        } else if (!resume) {
          await clearSession(id);
        }
      } else if (!resume) {
        await clearSession(id);
      }

      await loadWindow(start);
      const all = await Promise.all(
        chars.map((_, i) => isSkippable(chars[i]) ? true : getStroke(id, i).then(svg => !!svg))
      );
      setStrokesDone(all);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, textObj, lang]);

  /* ───────── 7칸 윈도 로드 ───────── */
  const loadWindow = async (start: number) => {
    if (!textObj || start >= chars.length) return;

    let i = start;
    while (i < chars.length && isSkippable(chars[i])) i++;
    if (i !== start) { await loadWindow(i); return; }

    const g: string[]          = [];
    const p: (string|null)[]   = [];

    for (let col = 0; col < WINDOW; col++) {
      const gi = i - CURCOL + col;
      g.push(gi >= 0 && gi < chars.length ? chars[gi] : '');
       // ▶ 왼쪽이든 오른쪽이든, 윈도 안 글자는 모두 SVG 조회
       p.push(
         gi >= 0 && gi < chars.length
           ? (await getStroke(id, gi)) ?? null
           : null
       );
         }

    setGuide(g);
    setPrevSvgs(p);
    setCurrentSvg((await getStroke(id, i)) ?? null);
    setIdx(i);
  };

  /* ───────── 콜백들 ───────── */
  const handleDone = async (svg: string) => {
    if (!textObj) return;
    await saveStroke(id, idx, svg);
    setCurrentSvg(svg);

    setPrevSvgs(prev => { const cp=[...prev]; cp[CURCOL]=svg; return cp; });
     // ✅ 현재 글자 완료 표시
     setStrokesDone(prev => { const cp=[...prev]; cp[idx] = true; return cp; });
    
    const next = findNext(idx);
    if (next < chars.length) {
      await loadWindow(next);
    } else {
      // 마지막 글자를 방금 저장했다면 바로 완료 페이지로 이동
      gotoComplete();
    }
  };

  const handleClear = async () => {
    if (!textObj) return;
    await deleteStroke(id, idx);
    setCurrentSvg(null);
    setPrevSvgs(prev => { const cp=[...prev]; cp[CURCOL]=null; return cp; });
   // ✅ 현재 글자 미완료 표시
 setStrokesDone(prev => { const cp=[...prev]; cp[idx] = false; return cp; });

  };

  const handleMidSave = async () => {
    if (!textObj) return;
    if (currentSvg) await saveStroke(id, idx, currentSvg);

    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) { alert('로그인이 필요합니다.'); return; }

    const nextIdx = currentSvg ? findNext(idx) : idx;

    const { error } = await supabase.from('copy_progress').upsert(
      {
        user_id:user.id, session_id:id, title:textObj.title,
        progress_idx:nextIdx, lang
      },
      { onConflict:'session_id,user_id,lang' }
    );
    if (error) { console.error(error); alert('❌ 중간 저장 실패'); return; }
    alert('중간 저장 완료!');
  };

  const handleReset = async () => {
    if (!textObj) return;
    if (confirm('모든 글자를 삭제하고 처음부터 다시 시작할까요?')) {
      await clearSession(id);
      await loadWindow(0);
    }
  };

  const gotoComplete = () => router.push(`/copy/${id}/complete`);

  /* ───────── 파생값 ───────── */
const everyDone   = strokesDone.length === chars.length &&
                       strokesDone.every(Boolean);
   const isFinished  = everyDone;
  
  /* ───────── 렌더 ───────── */
  if (!id) return null;
  if (!textObj)    return <p>잘못된 경전 ID입니다.</p>;

  return (
    <main className="flex flex-col max-w-[460px] items-center p-6 select-none">
      {/* 뒤로가기 */}


      {/* 제목 */}
      <div className="w-full h-16 bg-red-light rounded-xl flex items-center mb-4 pl-1">
        <Image src="/lotusbeige.png" alt="lotus" width={48} height={48}
               className="object-contain border-beige mx-2"/>
        <div>
          <div className="flex items-baseline">
            <h2 className="text-2xl text-beige font-semibold">{textObj.title}</h2>
            <p className="px-4 text-sm text-beige">{idx+1}/{chars.length}</p>
          </div>
          <p className="text-sm text-beige">고요히 마음을 비워보세요</p>
        </div>
      </div>

      {/* 트레이싱 */}
      <TracingCanvas
        char={chars[idx]}
        lang={lang}
        initialSvg={currentSvg}
        guideChars={guide}
        prevSvgs={prevSvgs}
        onFinish={handleDone}
        onClear={handleClear}
        onPrev={findPrev(idx)>=0 ? ()=>loadWindow(findPrev(idx)) : undefined}
        canPrev={findPrev(idx)>=0}
      />

      {/* 하단 버튼들 */}
      <div className="w-full flex gap-4 my-4">
        <button onClick={handleReset}
                className="flex-1 px-4 py-2 font-bold border border-red bg-white text-red-dark rounded-xl hover:bg-red hover:text-white transition">
          전체 리셋
        </button>
        <button onClick={handleMidSave}
                className="flex-1 px-4 py-2 font-bold border bg-red-light text-white rounded-xl hover:bg-red hover:text-white transition">
          중간 저장
        </button>
      </div>

      {/* 완성본 보기 */}
      <button onClick={gotoComplete} disabled={!isFinished}
              className={`w-full px-4 py-2 font-bold rounded-xl transition ${
                isFinished
                  ? 'border border-red-light bg-red-light text-white hover:bg-red'
                  : 'border border-gray-300 text-gray-400 cursor-not-allowed'
              }`}>
        완성본 보기
      </button>
    </main>
  );
}
