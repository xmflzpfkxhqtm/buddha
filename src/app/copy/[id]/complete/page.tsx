'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { copyTexts } from '@/data/copyTexts';
import { getStroke } from '@/lib/copyStore';
import { toPng } from 'html-to-image';
import { supabase } from '@/lib/supabaseClient';   // service key 필요 X
import { Share }     from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';


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
      const dataUrl = await toPng(sheetRef.current!, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#f8f5ee',
        style: {
          paddingBottom: '32px', // 2rem
          boxSizing: 'border-box',
          borderRadius: '1rem',
        },
      });
      setPngUrl(dataUrl);
    })();
  }, [textObj, svgs]);

  /* ---------- 핸들러들 ---------- */
  const handleShare = async () => {
    if (!pngUrl) return;
  
    /* 1️⃣ 네이티브 앱( iOS / Android ) → Capacitor Share 플러그인 */
    if (Capacitor.isNativePlatform()) {
      try {
        const b64 = pngUrl.split(',')[1];
        const name = `buddha_${Date.now()}.png`;
        const { uri } = await Filesystem.writeFile({
          path: name,
          data: b64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: `${textObj?.title} 사경`,
          text: '사경한 경전을 함께 나눠요 🙏',
          files: [uri],
        });
        return;
      } catch (err) {
        /* 사용자가 취소하거나 오류 → 웹 Share 로 폴백 */
        console.warn('Native share failed, falling back …', err);
      }
    }
  
    /* 2️⃣ PWA / 모바일 브라우저 → Web Share API */
    if (navigator.share) {
      try {
        const blob = await (await fetch(pngUrl)).blob();
        await navigator.share({
          title: `${textObj?.title} 사경`,
          text: '사경한 경전을 함께 나눠요 🙏',
          files: [new File([blob], `${textObj?.title}.png`, { type: 'image/png' })],
        });
        return;
      } catch {
        /* 사용자가 취소 */
      }
    }
  
    /* 3️⃣ 데스크톱 등 → 커스텀 모달 */
    setShowShare(true);
  };
  
  const saveToGallery = async () => {
    if (!pngUrl) return;
    try {
      const b64 = pngUrl.split(',')[1];
      const fileName = `buddha_${Date.now()}.png`;
      const { uri } = await Filesystem.writeFile({
        directory: Directory.ExternalStorage,
        path: `Pictures/${fileName}`,
        data: b64,
      });
      alert('✅ 갤러리에 저장되었습니다!');
    } catch (err) {
      console.error(err);
      alert('저장 실패: ' + (err as Error).message);
    }
  };

  async function saveToNotebook() {
    if (!pngUrl || !textObj) return;
  
    /* ---------- PNG → Blob ---------- */
    const res      = await fetch(pngUrl);
    const blob     = await res.blob();
    const fileName = `${id}-${Date.now()}.png`;
  
    /* ---------- Storage 업로드 ---------- */
    const { error: upErr } = await supabase
      .storage
      .from('copy-thumbs')
      .upload(`public/${fileName}`, blob, {
        contentType: 'image/png',
        upsert: true,
      });
  
    if (upErr) {
      alert('PNG 업로드 실패 🥲');
      return;
    }
  
    const { data: { publicUrl } } = supabase
      .storage
      .from('copy-thumbs')
      .getPublicUrl(`public/${fileName}`);
  
    /* ---------- 유저 확인 ---------- */
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
  
    /* ---------- 1) 새 완성본 INSERT ---------- */
    const { error: insertErr } = await supabase
      .from('copy_notes')
      .insert({
        session_id   : id,
        user_id      : user.id,
        lang,
        title        : textObj.title,
        progress_idx : chars.length - 1,
        completed    : true,
        thumb_url    : publicUrl,
      });
  
    if (insertErr) {
      console.error(insertErr);
      alert('사경노트 저장 실패 😢');
      return;
    }
  
    /* ---------- 2) 기존 진행중 레코드 삭제 ---------- */
    await supabase
      .from('copy_notes')
      .delete()
      .eq('user_id', user.id)
      .eq('session_id', id)
      .eq('lang', lang)
      .eq('completed', false);
  
    alert('✅ "나의 사경노트"에 저장되었습니다!');
  }
    
  /* ---------- 렌더링 ---------- */
  if (!isIdString) return null;
  if (!textObj)    return <p>잘못된 경전 ID입니다.</p>;
  if (isLoading)   return <p className="text-center py-12">시트 불러오는 중…</p>;

  return (
    <main className="p-4 max-w-[460px] my-4 mx-auto">
      <h1 className="font-bold text-red mb-4 text-2xl">
        {textObj?.title} ({lang === 'han' ? '한문' : '한글'})
      </h1>
      <p className="mb-4 text-start text-red-dark text-sm">오늘도 마음에 새긴 한 글자,<br /> 나를 위한 작은 수행입니다.</p>

      {/* 시트 */}
      <div
        ref={sheetRef}
        className="flex justify-center bg-white items-center my-4 py-4 overflow-visible rounded-xl">
        {lang === 'kor' ? (
          <KoreanSheet chars={chars} svgs={svgs} />
        ) : (
          <HanjaSheet chars={chars} svgs={svgs} />
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-col space-y-4 mt-8">
        <div className="flex space-x-4">
          <button
            onClick={handleShare}
            disabled={!pngUrl}
            className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red hover:text-white transition disabled:opacity-40"
          >
            이미지로 공유하기
          </button>
          <button
            onClick={saveToGallery}
            disabled={!pngUrl}
            className="w-full py-3 bg-white text-red-dark border border-red font-bold rounded-4xl hover:bg-red hover:text-white transition disabled:opacity-40"
          >
            갤러리에 저장하기
          </button>
        </div>

        <button
          onClick={saveToNotebook}
          disabled={!pngUrl}
          className="w-full py-3 bg-red-light text-white font-bold rounded-4xl hover:bg-red transition disabled:opacity-40"
        >
          나의 사경노트에 저장
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
              saveToNotebook();
              setShowSave(false);
            }}
            className="w-full py-2 rounded bg-green-600 text-white mb-3"
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
  const rows = Array.from({ length: 6 }, (_, rowIdx) =>
    chars.slice(rowIdx * 7, (rowIdx + 1) * 7)
  );
  return (
    <div className="flex flex-col gap-0 justify-start w-full">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex flex-row gap-0">
          {row.map((c, colIdx) => {
            const idx = rowIdx * 7 + colIdx;
            return (
              <div key={colIdx} className="w-[50px] h-[50px] border border-red-light relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center leading-none justify-center opacity-10 select-none text-2xl font-['MaruBuri'] text-red-dark">{c}</span>
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
  const cols = Array.from({ length: 8 }, (_, colIdx) =>
    chars.slice(colIdx * 5, (colIdx + 1) * 5)
  );
  return (
    <div className="flex flex-row-reverse gap-1 justify-start w-full">
      {cols.map((col, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-0">
          {col.map((c, rowIdx) => {
            const idx = colIdx * 5 + rowIdx;
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
