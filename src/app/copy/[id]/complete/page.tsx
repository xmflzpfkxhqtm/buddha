// src/app/copy/[id]/complete/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { copyTexts } from '@/data/copyTexts';
import { getStroke } from '@/lib/copyStore';
import html2canvas from 'html2canvas';

export default function CompletePage() {
  const { id } = useParams();
  if (typeof id !== 'string') return null;

  const textObj = copyTexts.find(t => t.id === id);
  if (!textObj) return <p>잘못된 경전 ID입니다.</p>;

  const lang: 'han' | 'kor' = 'han'; // 또는 'kor'
  const chars = [...textObj[lang]]; 
  const sheetRef = useRef<HTMLDivElement>(null);
  const [pngUrl, setPngUrl] = useState<string>();

  // 캡처 & PNG 만들기
  useEffect(() => {
    (async () => {
      await new Promise(r => setTimeout(r, 50));        // 레이아웃 안정화
      const canvas = await html2canvas(sheetRef.current!);
      setPngUrl(canvas.toDataURL('image/png'));
    })();
  }, []);

  return (
    <main className="p-6">
      <h1 className="font-bold mb-4">완성본</h1>

      {/* 시트 렌더링 */}
      <div
        ref={sheetRef}
        className="grid grid-cols-8 gap-2 p-4 border">
        {chars.map((c, i) => (
          <Cell key={i} c={c} sessionId={id} idx={i} />
        ))}
      </div>

      {pngUrl ? (
        <a
          href={pngUrl}
          download={`${textObj.title}-사경.png`}
          className="mt-6 inline-block bg-green-600 text-white px-4 py-2 rounded">
          PNG 다운로드
        </a>
      ) : (
        <p className="mt-6 text-gray-500">PNG 생성 중…</p>
      )}
    </main>
  );
}

// 글자+stroke 셀
function Cell({ c, sessionId, idx }: { c: string; sessionId: string; idx: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    getStroke(sessionId, idx).then(svg => setSvg(svg ?? null));
  }, [sessionId, idx]);
  return (
    <div className="relative w-20 h-20 border">
      <span className="absolute inset-0 flex items-center justify-center opacity-10 select-none">
        {c}
      </span>
      {svg && (
        <svg
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
