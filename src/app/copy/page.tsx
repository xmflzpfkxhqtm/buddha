'use client';

import { useState } from 'react';
import Link from 'next/link';
import { copyTexts } from '@/data/copyTexts';   // alias(@) 안 쓰면 상대경로로 수정

export default function CopyHome() {
  /** ─────────────────────────────────────────
   *  언어 선택: kor = 한글, han = 한문
   *  ───────────────────────────────────────── */
  const [lang, setLang] = useState<'kor' | 'han'>('kor');

  /** 선택-버튼 공통 클래스 */
  const btnBase =
    'p-3 rounded-lg border cursor-pointer transition duration-150';

  return (
    <main className="min-h-screen w-full max-w-[460px] h-full p-4 space-y-4">
      {/* 언어 선택 버튼 */}
  
      <div className="w-full z-1 pt-8">
          <h2 className="text-4xl text-red font-semibold text-start">
            대신귀여운사경<br />을 드리겠습니다
          </h2>
          <p className="text-base text-red font-medium text-start mt-2">
            사경을 해보세요<br />사경을 하게됩니다.
          </p>
        </div>
      <div className="w-full flex gap-3">
        {[
          { id: 'kor', label: '한글' },
          { id: 'han', label: '한문' },
        ].map(b => (
          <button
            key={b.id}
            onClick={() => setLang(b.id as 'kor' | 'han')}
            className={
              btnBase +
              (lang === b.id
                ? ' border-red bg-red-light text-white'
                : ' border-red bg-white text-black')
            }
          >
            {b.label}
          </button>
        ))}
      </div>
      <h1 className="text-xl text-red-dark font-bold">사경할 경전 선택</h1>

      <ul className="space-y-3">
        {copyTexts.map(t => (
          <li key={t.id}>
            {/* ✅ 클릭 가능 영역  ─ lang 쿼리 파라미터 전달 */}
            <Link
              href={`/copy/${t.id}?lang=${lang}`} // 예) /copy/heart?lang=kor
              className="block border border-red-light bg-red-light text-beige p-4 rounded-xl hover:bg-white hover:border hover:border-red-light hover:text-red-dark"
            >
              {t.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
