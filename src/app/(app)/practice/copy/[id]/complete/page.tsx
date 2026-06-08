/* ----------------------------------------------------------
 *  CompletePage.tsx  (네이티브 전용 · JPEG 단일 파이프라인)
 *  버튼 구성:
 *    1행 [수정하기] [공유하기]
 *    2행 [나의 사경노트에 저장]
 *  - Web-Share / 브라우저 분기 · 모달 전부 제거
 *  - DOM → JPEG(quality 0.8) 한 번 캡처 → ① 네이티브 Share(files) ② Supabase 업로드
 * ---------------------------------------------------------*/
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useMemo } from 'react';
import { toJpeg } from 'html-to-image';

import { Capacitor }                        from '@capacitor/core';
import { Share }                            from '@capacitor/share';
import { Filesystem, Directory }            from '@capacitor/filesystem';

import { copyTexts } from '@/data/copyTexts';
import { getStroke } from '@/lib/copyStore';
import { supabase }  from '@/lib/supabaseClient';   // service key 필요 X

/* ===================================================================== */
/*                                COMPONENT                              */
/* ===================================================================== */
export default function CompletePage() {
  const params    = useParams();
  const router    = useRouter();
  const id        = params.id as string;
  const sheetRef  = useRef<HTMLDivElement>(null);

  const [jpegUrl , setJpegUrl]  = useState<string>();
  const [svgs    , setSvgs]     = useState<(string | null)[]>([]);
  const [loading , setLoading]  = useState(true);

  const textObj  = copyTexts.find(t => t.id === id);
  const lang: 'han' | 'kor' = textObj?.lang ?? 'han';
  const chars    = useMemo(() => (textObj ? [...textObj.text] : []), [textObj]);

  /* ---------------------- SVG 로딩 ---------------------- */
  useEffect(() => {
    if (!textObj) return;
    setLoading(true);
    Promise.all(chars.map((_, i) => getStroke(id, i).then(svg => svg ?? null)))
      .then(setSvgs)
      .finally(() => setLoading(false));
  }, [id, textObj, chars]);

  /* ---------------------- JPEG 캡처 ---------------------- */
  useEffect(() => {
    if (!textObj || !sheetRef.current) return;
    (async () => {
      await new Promise(r => setTimeout(r, 50));          // 렌더 안정화
      const dataUrl = await toJpeg(sheetRef.current!, {
        pixelRatio : Math.min(2, window.devicePixelRatio),
        quality    : 0.8,
        backgroundColor: '#f8f5ee',
        style      : { paddingBottom: '32px', boxSizing: 'border-box', borderRadius: '1rem' },
      });
      setJpegUrl(dataUrl);
    })();
  }, [textObj, svgs]);

  /* ---------------------- 네이티브 공유 ------------------ */
  const handleShare = async () => {
    if (!jpegUrl || !Capacitor.isNativePlatform()) return;

    const base64 = jpegUrl.split(',')[1];
    const name   = `buddha_${Date.now()}.jpg`;

    const { uri } = await Filesystem.writeFile({
      directory: Directory.Cache,
      path     : name,
      data     : base64,
    });

    await Share.share({
      title : `${textObj?.title} 사경`,
      text  : '사경한 경전을 함께 나눠요 🙏',
      files : [uri],         // JPEG 파일 첨부
    });
  };

  /* ------------------ 나의 사경노트 저장 ---------------- */
  const saveToNotebook = async () => {
    if (!jpegUrl || !textObj) return;

    /* 1. JPEG → Blob */
    const blob     = await (await fetch(jpegUrl)).blob();
    const fileName = `${id}-${Date.now()}.jpg`;

    /* 2. Supabase 업로드 */
    const { error: upErr } = await supabase
      .storage.from('copy-thumbs')
      .upload(`public/${fileName}`, blob, {
        upsert     : true,
        contentType: 'image/jpeg',
      });
    if (upErr) { alert('이미지 업로드 실패 🥲'); return; }

    const { data: { publicUrl } } = supabase
      .storage.from('copy-thumbs')
      .getPublicUrl(`public/${fileName}`);

    /* 3. 사용자 & DB */
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('로그인이 필요합니다.'); return; }

    const { error: insertErr } = await supabase.from('copy_notes').insert({
      session_id   : id,
      user_id      : user.id,
      lang,
      title        : textObj.title,
      progress_idx : chars.length - 1,
      completed    : true,
      thumb_url    : publicUrl,
    });
    if (insertErr) { alert('사경노트 저장 실패 😢'); return; }

    await supabase.from('copy_progress')      // 진행 중 삭제
      .delete()
      .eq('user_id', user.id)
      .eq('session_id', id)
      .eq('lang', lang);

    alert('✅ "나의 사경노트"에 저장되었습니다!');
  };

  /* ---------------------- 렌더링 ------------------------ */
  if (!textObj) return <p className="text-center py-12">잘못된 경전 ID입니다.</p>;
  if (loading)   return <p className="text-center py-12">시트 불러오는 중…</p>;

  return (
    <main
      className="p-6 max-w-[460px] mb-4"
      style={{ marginTop: 'calc(max(44px, env(safe-area-inset-top)) + 16px)' }}
    >
      <h1 className="font-bold text-accent mb-4 text-2xl">
        {textObj.title} ({lang === 'han' ? '한문' : '한글'})
      </h1>
      <p className="mb-4 text-start text-accent text-sm">
        오늘도 마음에 새긴 한 글자,<br />나를 위한 작은 수행입니다.
      </p>

      {/* ---------- 시트 ---------- */}
      <div ref={sheetRef} className="flex justify-center bg-surface-elevated my-4 py-4 rounded-xl">
        {lang === 'kor'
          ? <KoreanSheet chars={chars} svgs={svgs} />
          : <HanjaSheet   chars={chars} svgs={svgs} />}
      </div>

      {/* ---------- 하단 버튼 ---------- */}
      <div className="flex flex-col space-y-4 mt-8">
        {/* 1행 */}
        <div className="flex space-x-4">
          <button
            onClick={() => router.push(`/practice/copy/${id}?resume=1`)}
            className="w-full py-3 bg-surface-elevated text-accent border border-accent font-bold rounded-4xl hover:bg-accent hover:text-on-brand transition">
            수정하기
          </button>
          <button
            onClick={handleShare}
            disabled={!jpegUrl}
            className="w-full py-3 bg-surface-elevated text-accent border border-accent font-bold rounded-4xl hover:bg-accent hover:text-on-brand transition disabled:opacity-40">
            공유하기
          </button>
        </div>

        {/* 2행 */}
        <button
          onClick={saveToNotebook}
          disabled={!jpegUrl}
          className="w-full py-3 bg-accent-soft text-on-brand font-bold rounded-4xl hover:bg-accent transition disabled:opacity-40">
          나의 사경노트에 저장
        </button>
      </div>

      {/* JPEG 생성 중 표시 */}
      {!jpegUrl && <p className="mt-6 text-ink-subtle">이미지 생성 중…</p>}
    </main>
  );
}

/* ===================================================================== */
/*                        시트(한글 7×? / 한자 5×?)                      */
/* ===================================================================== */
function KoreanSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  const rows = Array.from({ length: 6 }, (_, r) => chars.slice(r * 7, (r + 1) * 7));
  return (
    <div className="flex flex-col shadow rounded p-2">
      {rows.map((row, r) => (
        <div key={r} className="flex border-accent-soft border-t">
          {row.map((c, cIdx) => {
            const idx = r * 7 + cIdx;
            return (
              <div key={cIdx} className="w-[50px] h-[50px] relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none text-2xl font-['MaruBuri'] text-accent">
                  {c}
                </span>
                {svgs[idx] && (
                  <svg className="absolute inset-0 text-ink" viewBox="0 0 50 50" dangerouslySetInnerHTML={{ __html: svgs[idx]!.replace(/fill="black"/g, 'fill="currentColor"') }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HanjaSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  const cols = Array.from({ length: 8 }, (_, c) => chars.slice(c * 5, (c + 1) * 5));
  return (
    <div className="flex flex-row-reverse shadow rounded p-2">
      {cols.map((col, c) => (
        <div key={c} className="flex flex-col border-accent-soft border-r">
          {col.map((ch, rIdx) => {
            const idx = c * 5 + rIdx;
            return (
              <div key={rIdx} className="w-[50px] h-[50px] relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none text-2xl font-['Yuji_Mai'] text-accent">
                  {ch}
                </span>
                {svgs[idx] && (
                  <svg className="absolute inset-0 text-ink" viewBox="0 0 50 50" dangerouslySetInnerHTML={{ __html: svgs[idx]!.replace(/fill="black"/g, 'fill="currentColor"') }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
