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
    <main className="min-h-screen w-full max-w-[460px] h-full py-6 px-6 space-y-4">
      {/* --- ▼▼▼ 1. 상단 텍스트 수정 ▼▼▼ --- */}
      <div className="w-full z-1 pb-6">
          <h2 className="text-4xl text-red font-semibold text-start">
            법문을 <br />마음에 새겨보세요
          </h2>
          <p className="text-base text-red font-medium text-start mt-2">
            고요히 말씀을 손으로 좇아보는 시간
          </p>
      </div>
      {/* --- ▲▲▲ 1. 상단 텍스트 수정 ▲▲▲ --- */}

      {/* 언어 선택 버튼 */}
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
                ? ' border-red bg-red-light text-white' // 활성 상태
                : ' border-red bg-white text-black') // 비활성 상태
            }
          >
            {b.label}
          </button>
        ))}
      </div>

      <h1 className="text-xl text-red-dark font-bold">사경할 경전 선택</h1>

      <ul className="space-y-3">
        {copyTexts
          .filter(t => t.lang === lang)
          .map(t => (
            <li key={t.id}>
              <Link
                href={`/copy/${t.id}`}
                className="block border border-red-light bg-red-light text-beige p-4 rounded-xl hover:bg-white hover:border hover:border-red-light hover:text-red-dark transition-colors"
              >
                {t.title}
              </Link>
            </li>
          ))}
      </ul>

      {/* --- ▼▼▼ 2. 사용법/주의사항 텍스트 공간 추가 ▼▼▼ --- */}
      <div className="text-base text-red mt-8 pt-4 border-t border-gray-200">
        <p className="leading-relaxed">
          마음에 드는 경전을 골라 붓을 들어보세요.<br />
          한 획 한 획에 집중하다 보면 어느새 마음이 차분해질 거예요.<br />
          천천히, 정성껏 나만의 사경을 완성해보세요.<br />
          엄지를 사용하면 관절에 무리가 갈 수 있어요.<br />
          엄지보다는 검지나 중지로 쓰는 것을 권장합니다.
        </p>
        {/* 필요하다면 여기에 추가적인 안내 문구를 넣을 수 있습니다. */}
      </div>
      {/* --- ▲▲▲ 2. 사용법/주의사항 텍스트 공간 추가 ▲▲▲ --- */}
    </main>
  );
}