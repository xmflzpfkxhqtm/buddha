'use client';

export default function Loading({ fadeOut = false }: { fadeOut?: boolean }) {
  const message = fadeOut
    ? '부처님께서 말씀을 내리시는 중입니다.'
    : '마음의 소리에 귀 기울이는 중입니다.\n당신의 물음이 조용히 울리고 있습니다.';

  return (
    <div
      className={`flex flex-col justify-center items-center h-screen bg-[#F5F1E6] text-[#3E3E3E]
        transition-opacity duration-1000 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="text-5xl animate-float mb-4">🪷</div>
      <p className="text-xl font-bold text-center tracking-wide animate-fadeIn px-6 whitespace-pre-line">
        {message}
      </p>
    </div>
  );
}
