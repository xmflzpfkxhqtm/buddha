'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ScrollHeader from '../../components/ScrollHeader'; // 경로는 맞게 수정!
import BottomNav from '../../components/BottomNav'; // 경로는 폴더 구조에 따라 조절
import MarbleOverlay from '../../components/Overlay';

export default function Home() {
  const router = useRouter();

  return (
    <>
    <MarbleOverlay />
<main className="min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[url('/marble.png')] bg-red px-6 pt">
<ScrollHeader />
<div className="w-full h-16 bg-red-light border border-[0.5px] border-pink-light rounded-xl flex flex-row items-center pl-1 mt-8 justify-start">

<Image
  src="/lotusbeige.png"
  alt="lotus"
  width={48}
  height={48}
  className="object-contain border-beige mx-2"
/>
  <div className="flex flex-col">
  <p className="text font-medium text-white text-start">
  「부처님께 여쭙기」 기능이 출시되었습니다</p>
  <p className="text font-base text-pink-light text-start">
    클릭하여 자세히 알아보세요  </p>
</div>
</div>

<div className="w-full rounded-xl flex flex-col items-start pl-1 justify-start">

      <p className="text-2xl font-semibold text-white	text-center mt-4 mb-4">
어서오세요, 불자님      </p>

      </div>
      <div className="w-full overflow-x-auto no-scrollbar bg-red-light rounded-xl py-2 pl-2">
      <p className="text font-semibold text-white	text-left pl-1">
오늘의 수행은 🪷 </p>
        <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4">
          {/* 카드 1 */}
          <div
            onClick={() => router.push('/ask')}
            className="min-w-[240px] h-[360px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
          >
            <div className="h-[280px] w-full">
              <img
                src="/askvip.png"
                alt="부처님께 여쭙기"
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>
            <div className="flex-1 px-3 py-2">
              <p className="text-xs text-left text-white font-medium">
                부처님께 여쭙기
              </p>
              <p className="text-xs text-left text-pink-light font-medium">
                나의 고민에 대해 부처님이라면 어떤 말씀을 하실까요? 인공지능이 부처님의 지혜로 안내합니다
              </p>
            </div>
          </div>

          {/* 카드 2 - 복붙해서 추가 가능 */}
          <div
            onClick={() => router.push('/ask')}
            className="min-w-[240px] h-[360px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
          >
            <div className="h-[280px] w-full">
              <img
                src="/askvip.png"
                alt="부처님께 여쭙기"
                className="w-full h-full object-cover bg-red-light"
              />
            </div>
            <div className="flex-1 px-3 py-2">
              <p className="text-xs text-left text-white font-medium">
                부처님께 여쭙기
              </p>
              <p className="text-xs text-left text-pink-light font-medium">
                나의 고민에 대해 부처님이라면 어떤 말씀을 하실까요? 인공지능이 부처님의 지혜로 안내합니다
              </p>
            </div>
          </div>
</div>

</div>

<div className="w-full h-[0.5px] opacity-50 bg-[#E0DBCF] mt-6" />


      <p className="text-xs font-medium text-beige text-center mt-6 mb-24">
        &ldquo;부처님 손바닥&rdquo;은 인공지능(AI)을 통해 경전 속 부처님의 가르침을 쉽게 전해드리는, 누구나 질문하고 위로받을 수 있는 작은 법당입니다.
      </p>
      <BottomNav />

    </main>
    </>
  );
}
