'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
<main className="min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-6 py-10"
style={{ paddingBottom: 'calc(2.25rem + env(safe-area-inset-bottom))' }}>
<div className="w-full h-80 bg-[#F8F5EE] border border-[#E0DBCF] rounded-xl p-4 shadow-xl mb-6 flex flex-col items-center justify-center">
  <img
    src="/vip.png"
    alt="부처님"
    className="w-48 h-48 object-contain mb-2"
  />
  <h1 className="text-4xl font-bold text-[#4B3B2A] text-center">
    부처님 손바닥
  </h1>
  <h2 className="text-xl font-bold pt-4">
  부처님께 여쭙는 선문답의 시간
  </h2>

</div>


      <p className="font-bold	text-center mb-8">
        마음 속의 이야기를 하고<br />부처님의 지혜를 구해보세요
      </p>
      <button
        onClick={() => router.push('/ask')}
        className="w-full bg-brown font-bold	 text-white text-lg px-6 py-3 rounded-xl hover:bg-[#9C886D] transition"
      >
        부처님께 여쭙기
      </button>

      <p className="text-xs font-medium text-center mt-auto">
      “부처님 손바닥”은 인공지능(AI)을 통해 경전 속 부처님의 가르침을 쉽게 전해드리는, 누구나 질문하고 위로받을 수 있는 작은 법당입니다.
      </p>
    </main>
  );
}
