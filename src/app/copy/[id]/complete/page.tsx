/* ----------------------------------------------------------
 *  CompletePage.tsx
 *  iOS  : @capacitor-community/media 로 앨범 저장
 *  Android : @capacitor/filesystem (Pictures/)
 * ---------------------------------------------------------*/
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

import { Capacitor }                        from '@capacitor/core';
import { Share }                            from '@capacitor/share';
import { Filesystem, Directory }            from '@capacitor/filesystem';
import { Media }                            from '@capacitor-community/media';

import { copyTexts }   from '@/data/copyTexts';
import { getStroke }   from '@/lib/copyStore';
import { supabase }    from '@/lib/supabaseClient';   // service key 필요 X

/* ===================================================================== */
/*                    Android 저장 Helper + 권한 처리                     */
/* ===================================================================== */
const ensurePublicWrite = async () => {
  const { publicStorage } = await Filesystem.checkPermissions();
  if (publicStorage !== 'granted') {
    const res = await Filesystem.requestPermissions();
    if (res.publicStorage !== 'granted') throw new Error('저장 권한 거부됨');
  }
};

const saveToPicturesDir = async (dataUrl: string) => {
  await ensurePublicWrite();
  const b64  = dataUrl.split(',')[1];
  const name = `Pictures/buddha_${Date.now()}.png`;
  await Filesystem.writeFile({
    directory: Directory.ExternalStorage,
    path     : name,
    data     : b64,
  });
};

/* ===================================================================== */
/*                       iOS 저장 Helper (Media 플러그인)                 */
/* ===================================================================== */
const saveWithMedia = async (dataUrl: string) => {
  /* Media v8+: savePhoto 가 내부에서 권한 요청 */
  await Media.savePhoto({
    path            : dataUrl,   // data:image/png;base64,....
    albumIdentifier : 'Buddha',
  });
};

/* ===================================================================== */
/*                                COMPONENT                              */
/* ===================================================================== */
export default function CompletePage() {
  const params = useParams();
  const id = params.id as string;
  const sheetRef = useRef<HTMLDivElement>(null);

  const [pngUrl     , setPngUrl]   = useState<string>();
  const [showShare  , setShowShare] = useState(false);
  const [svgs       , setSvgs]      = useState<(string | null)[]>([]);
  const [isLoading  , setIsLoading] = useState(true);

  const isIdString     = typeof id === 'string';
  const textObj        = isIdString ? copyTexts.find(t => t.id === id) : null;
  const lang: 'han' | 'kor' = textObj?.lang ?? 'han';
  const chars          = textObj ? [...textObj.text] : [];

  /* ---------------------- SVG 로딩 ---------------------- */
  useEffect(() => {
    if (!isIdString || !textObj) return;
    setIsLoading(true);
    Promise.all(
      chars.map((_, i) => getStroke(id as string, i).then(svg => svg ?? null))
    )
      .then(setSvgs)
      .finally(() => setIsLoading(false));
  }, [id, isIdString, textObj, chars]);

  /* ---------------------- PNG 캡처 ---------------------- */
  useEffect(() => {
    if (!textObj || !sheetRef.current) return;
    (async () => {
      await new Promise(r => setTimeout(r, 50));
      const dataUrl = await toPng(sheetRef.current!, {
        pixelRatio     : 2,
        backgroundColor: '#f8f5ee',
        style          : {
          paddingBottom: '32px',
          boxSizing    : 'border-box',
          borderRadius : '1rem',
        },
      });
      setPngUrl(dataUrl);
    })();
  }, [textObj, svgs]);

  /* ---------------------- 공유 -------------------------- */
  const handleShare = async () => {
    if (!pngUrl) return;

    /* 1. 네이티브 Share */
    if (Capacitor.isNativePlatform()) {
      try {
        const b64  = pngUrl.split(',')[1];
        const name = `buddha_${Date.now()}.png`;
        const { uri } = await Filesystem.writeFile({
          directory: Directory.Cache,
          path     : name,
          data     : b64,
        });
        await Share.share({
          title: `${textObj?.title} 사경`,
          text : '사경한 경전을 함께 나눠요 🙏',
          files: [uri],
        });
        return;
      } catch (err) {
        console.warn('Native share failed, falling back …', err);
      }
    }

    /* 2. Web Share */
    if (navigator.share) {
      try {
        const blob = await (await fetch(pngUrl)).blob();
        await navigator.share({
          title: `${textObj?.title} 사경`,
          text : '사경한 경전을 함께 나눠요 🙏',
          files: [new File([blob], `${textObj?.title}.png`, { type: 'image/png' })],
        });
        return;
      } catch {/* ignore */}
    }

    /* 3. Fallback */
    setShowShare(true);
  };

  /* ---------------------- 갤러리 저장 ------------------- */
  const saveToGallery = async () => {
    if (!pngUrl) return;
    try {
      if (Capacitor.getPlatform() === 'ios') {
        await saveWithMedia(pngUrl);
      } else {
        await saveToPicturesDir(pngUrl);
      }
      alert('✅ 갤러리에 저장되었습니다!');
    } catch (err) {
      console.error(err);
      alert('저장 실패: ' + (err as Error).message);
    }
  };

  /* ------------------ 나의 사경노트 저장 ---------------- */
  async function saveToNotebook() {
    if (!pngUrl || !textObj) return;

    /* 1. PNG → Blob */
    const blob     = await (await fetch(pngUrl)).blob();
    const fileName = `${id}-${Date.now()}.png`;

    /* 2. Storage 업로드 */
    const { error: upErr } = await supabase
      .storage.from('copy-thumbs')
      .upload(`public/${fileName}`, blob, {
        contentType: 'image/png',
        upsert     : true,
      });
    if (upErr) {
      alert('PNG 업로드 실패 🥲');
      return;
    }

    const { data: { publicUrl } } = supabase
      .storage.from('copy-thumbs')
      .getPublicUrl(`public/${fileName}`);

    /* 3. 유저 확인 */
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    /* 4. 새 레코드 INSERT */
    const { error: insertErr } = await supabase.from('copy_notes').insert({
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

    /* 5. 진행중 레코드 삭제 */
    await supabase.from('copy_notes')
      .delete()
      .eq('user_id', user.id)
      .eq('session_id', id)
      .eq('lang', lang)
      .eq('completed', false);

    alert('✅ "나의 사경노트"에 저장되었습니다!');
  }

  /* ---------------------- 렌더링 ------------------------ */
  if (!isIdString) return null;
  if (!textObj)    return <p>잘못된 경전 ID입니다.</p>;
  if (isLoading)   return <p className="text-center py-12">시트 불러오는 중…</p>;

  return (
    <main className="p-4 max-w-[460px] my-4 mx-auto">
      <h1 className="font-bold text-red mb-4 text-2xl">
        {textObj.title} ({lang === 'han' ? '한문' : '한글'})
      </h1>
      <p className="mb-4 text-start text-red-dark text-sm">
        오늘도 마음에 새긴 한 글자,<br />나를 위한 작은 수행입니다.
      </p>

      {/* ---------- 시트 ---------- */}
      <div
        ref={sheetRef}
        className="flex justify-center bg-white items-center my-4 py-4 overflow-visible rounded-xl"
      >
        {lang === 'kor'
          ? <KoreanSheet chars={chars} svgs={svgs} />
          : <HanjaSheet   chars={chars} svgs={svgs} />}
      </div>

      {/* ---------- 하단 버튼 ---------- */}
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

      {/* ---------- 공유 모달 ---------- */}
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
              href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(
                pngUrl ?? ''
              )}`}
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

      {/* ---------- PNG 생성 표시 ---------- */}
      {!pngUrl && <p className="mt-6 text-gray-500">PNG 생성 중…</p>}
    </main>
  );
}

/* ===================================================================== */
/*                        시트(한글 7×? / 한자 5×?)                      */
/* ===================================================================== */
function KoreanSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  const rows = Array.from({ length: 6 }, (_, r) => chars.slice(r * 7, (r + 1) * 7));
  return (
    <div className="flex flex-col">
      {rows.map((row, r) => (
        <div key={r} className="flex">
          {row.map((c, cIdx) => {
            const idx = r * 7 + cIdx;
            return (
              <div key={cIdx} className="w-[50px] h-[50px] border border-red-light relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center leading-none justify-center opacity-10 select-none text-2xl font-['MaruBuri'] text-red-dark">
                  {c}
                </span>
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

function HanjaSheet({ chars, svgs }: { chars: string[]; svgs: (string | null)[] }) {
  const cols = Array.from({ length: 8 }, (_, c) => chars.slice(c * 5, (c + 1) * 5));
  return (
    <div className="flex flex-row-reverse gap-1">
      {cols.map((col, c) => (
        <div key={c} className="flex flex-col">
          {col.map((ch, rIdx) => {
            const idx = c * 5 + rIdx;
            return (
              <div key={rIdx} className="w-[50px] h-[50px] border border-red-light relative flex items-center justify-center rounded">
                <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none text-2xl font-['Yuji_Mai'] text-red-dark">
                  {ch}
                </span>
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

/* ===================================================================== */
/*                              Modal & Link                             */
/* ===================================================================== */
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white p-6 rounded-t-2xl">
        {children}
        <button onClick={onClose} className="mt-4 w-full py-2 text-center rounded bg-gray-100">
          닫기
        </button>
      </div>
    </div>
  );
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full py-2 rounded bg-blue-500/10 text-center">
      {label}
    </a>
  );
}
