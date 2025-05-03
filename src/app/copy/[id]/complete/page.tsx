'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { copyTexts } from '@/data/copyTexts';
import { getStroke } from '@/lib/copyStore';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabaseClient';   // service key 필요 X

export default function CompletePage() {
  const { id } = useParams();
  const sheetRef = useRef<HTMLDivElement>(null);

  const [pngUrl, setPngUrl]         = useState<string>();      // 만들어 둔 PNG
  const [showShare, setShowShare]   = useState(false);         // ★ 공유 fallback 모달
  const [showSave, setShowSave]     = useState(false);         // ★ 저장 모달
  const [svgs, setSvgs]             = useState<(string | null)[]>([]); // 모든 셀의 SVG
  const [isLoading, setIsLoading]   = useState(true);

  const isIdString = typeof id === 'string';
  const textObj = isIdString ? copyTexts.find(t => t.id === id) : null;

  const lang: 'han' | 'kor' = textObj ? (textObj.lang as 'han' | 'kor') : 'han';
  const chars = textObj ? [...textObj[lang]] : [];

  // 시트 크기 상수
  const KOR_COLS = 7, KOR_ROWS = 10;
  const HAN_ROWS = 7, HAN_COLS = 6;

  // 모든 SVG 불러오기
  useEffect(() => {
    if (!isIdString || !textObj) return;
    setIsLoading(true);
    Promise.all(
      chars.map((_, i) => getStroke(id as string, i).then(svg => svg ?? null))
    ).then(setSvgs).finally(() => setIsLoading(false));
  }, [id, isIdString, textObj, lang]);

  /* ---------- PNG 캡처 ---------- */
  useEffect(() => {
    if (!textObj || !sheetRef.current) return;
    (async () => {
      await new Promise(r => setTimeout(r, 50));
      const canvas = await html2canvas(sheetRef.current!);
      setPngUrl(canvas.toDataURL('image/png'));
    })();
  }, [textObj, svgs]);

  /* ---------- 핸들러들 ---------- */
  const handleShare = async () => {
    if (!pngUrl) return;

    // Web Share API 지원 브라우저 (모바일 등)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${textObj?.title} 사경`,
          text : '사경한 경전을 함께 나눠요 🙏',
          files: [
            await (async () => {
              const res   = await fetch(pngUrl);
              const blob  = await res.blob();
              return new File([blob], `${textObj?.title}.png`, { type: 'image/png' });
            })(),
          ],
        });
        return;
      } catch {
        /* 사용자가 취소 */
      }
    }
    // 지원 안되면 fallback 모달
    setShowShare(true);
  };

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${textObj?.title}-사경.png`;
    a.click();
  };

  async function saveToNotebook() {
    if (!pngUrl || !textObj) return;
  
    // 1) PNG → Blob
    const res  = await fetch(pngUrl);
    const blob = await res.blob();
    const fileName = `${id}-${Date.now()}.png`;
  
    // 2) Storage 업로드 (public.bucket: copy-thumbs)
    const { error: uploadErr } = await supabase
      .storage
      .from('copy-thumbs')
      .upload(fileName, blob, { contentType: 'image/png', upsert: true });
  
    if (uploadErr) {
      alert('PNG 업로드 실패 🥲');
      return;
    }
  
    const { data: { publicUrl } } = supabase
      .storage
      .from('copy-thumbs')
      .getPublicUrl(fileName);
  
    // 3) copy_notes upsert
    const { error: dbErr } = await supabase
      .from('copy_notes')
      .upsert(
        {
          session_id : id,                 // copyTexts id
          title      : textObj.title,
          progress_idx: chars.length - 1,  // 0-base
          completed  : true,
          thumb_url  : publicUrl,
          lang : lang
        },
        { onConflict: 'session_id,user_id' }   // 이미 있으면 update
      );
  
    if (dbErr) {
      console.error(dbErr);
      alert('사경노트 저장 실패 😢');
      return;
    }
  
    alert('✅ "나의 사경노트"에 저장되었습니다!');
  }
  
  /* ---------- 렌더링 ---------- */
  if (!isIdString) return null;
  if (!textObj)    return <p>잘못된 경전 ID입니다.</p>;
  if (isLoading)   return <p className="text-center py-12">시트 불러오는 중…</p>;

  return (
    <main className="p-6 max-w-[460px] mx-auto">
      <h1 className="font-bold mb-4 text-xl">완성본</h1>

      {/* 시트 */}
      <div ref={sheetRef} className="flex justify-center items-center my-4">
        {lang === 'kor' ? (
          <KoreanSheet chars={chars} svgs={svgs} />
        ) : (
          <HanjaSheet chars={chars} svgs={svgs} />
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={handleShare}
          disabled={!pngUrl}
          className="flex-1 py-2 rounded-xl font-bold text-white bg-red-light disabled:opacity-40"
        >
          공유하기
        </button>
        <button
          onClick={() => setShowSave(true)}          /* ★ */
          disabled={!pngUrl}
          className="flex-1 py-2 rounded-xl font-bold text-red-dark border border-red-light bg-white disabled:opacity-40"
        >
          저장하기
        </button>
      </div>

      {/* ---------- 모달들 ---------- */}
      {showShare && (
        <Modal onClose={() => setShowShare(false)}>
          <h2 className="font-bold mb-4">공유하기</h2>
          <p className="text-sm mb-4">공유할 방법을 고르세요.</p>
          <div className="space-y-3">
            <ShareLink
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                '사경한 경전을 함께 나눠요 🙏'
              )}`}
              label="Twitter"
            />
            <ShareLink
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                pngUrl ?? ''
              )}`}
              label="Facebook"
            />
            <ShareLink
              href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pngUrl ?? '')}`}
              label="Line / 기타"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(pngUrl ?? '');
                alert('이미지 URL이 복사되었습니다.');
                setShowShare(false);
              }}
              className="w-full py-2 rounded bg-gray-200"
            >
              URL 복사
            </button>
          </div>
        </Modal>
      )}

      {showSave && (
        <Modal onClose={() => setShowSave(false)}>
          <h2 className="font-bold mb-4">저장하기</h2>
          <button
            onClick={() => {
              downloadPng();
              setShowSave(false);
            }}
            className="w-full py-2 rounded bg-green-600 text-white mb-3"
          >
            앨범에 저장
          </button>
          <button
            onClick={() => {
              saveToNotebook();
              setShowSave(false);
            }}
            className="w-full py-2 rounded bg-yellow-300 text-black"
          >
            나의 사경노트에 저장
          </button>
        </Modal>
      )}

      {!pngUrl && <p className="mt-6 text-gray-500">PNG 생성 중…</p>}
    </main>
  );
}

// 한글 시트: 7x10 가로
function KoreanSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  const rows = Array.from({ length: 10 }, (_, rowIdx) =>
    chars.slice(rowIdx * 7, (rowIdx + 1) * 7)
  );
  return (
    <div className="flex flex-col gap-0">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex flex-row gap-0">
          {row.map((c, colIdx) => {
            const idx = rowIdx * 7 + colIdx;
            return (
              <div key={colIdx} className="w-[50px] h-[50px] border border-red-light relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none text-2xl font-['MaruBuri'] text-red-dark">{c}</span>
                {svgs[idx] && (
                  <svg className="absolute inset-0" viewBox="0 0 50 50" dangerouslySetInnerHTML={{ __html: svgs[idx]! }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// 한자 시트: 6x7 세로, 오른쪽부터 왼쪽
function HanjaSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  // 6열, 각 열에 7글자씩, 오른쪽부터 왼쪽으로
  const cols = Array.from({ length: 6 }, (_, colIdx) =>
    chars.slice(colIdx * 7, (colIdx + 1) * 7)
  );
  return (
    <div className="flex flex-row-reverse gap-1">
      {cols.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-0">
          {col.map((c, rowIdx) => {
            const idx = colIdx * 7 + rowIdx;
            return (
              <div key={rowIdx} className="w-[50px] h-[50px] border border-red-light relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none text-2xl font-['Yuji_Mai'] text-red-dark">{c}</span>
                {svgs[idx] && (
                  <svg className="absolute inset-0" viewBox="0 0 50 50" dangerouslySetInnerHTML={{ __html: svgs[idx]! }} />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- 재사용 모달 컴포넌트 ---------- */
function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 flex items-end justify-center z-50"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-white p-6 rounded-t-2xl"
      >
        {children}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-center rounded bg-gray-100"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

/* ---------- 공유 링크 버튼 ---------- */
function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full py-2 rounded bg-blue-500/10 text-center"
    >
      {label}
    </a>
  );
}
