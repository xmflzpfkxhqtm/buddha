'use client';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-[#F5F1E6] flex flex-col justify-center items-center text-red-dark font-maruburi">
      <div className="animate-fadeIn">
        <p className="text-2xl font-semibold mb-2">부처님 손바닥</p>
        <p className="text-sm">폰트를 준비 중입니다... 🪔</p>
      </div>
    </div>
  );
}
