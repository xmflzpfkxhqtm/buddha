'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ScrollHeader from '../../components/ScrollHeader';
import MarbleOverlay from '../../components/Overlay';
import { useEffect, useState } from 'react';
import { useBookmarkStore } from '@/stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const { setBookmark } = useBookmarkStore();

  const [title, setTitle] = useState('');
  const [index, setIndex] = useState<number | null>(null);
  const [sentence, setSentence] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 👈 최소 로딩용 상태

  useEffect(() => {
    const fetchAll = async () => {
      const start = Date.now();

      const [teachingRes, userRes] = await Promise.all([
        fetch('/api/today-teaching').then((res) => res.json()),
        supabase.auth.getUser(),
      ]);

      const end = Date.now();
      const elapsed = end - start;
      const remaining = Math.max(3000 - elapsed, 0); // 👈 최소 1초 보장

      setTitle(teachingRes.title);
      setIndex(teachingRes.index);
      setSentence(teachingRes.sentence);

      const fullName = userRes.data.user?.user_metadata?.full_name;
      setUserName(fullName ?? null);

      setTimeout(() => {
        setIsLoading(false); // 👈 최소 1초 후에 로딩 해제
        sessionStorage.setItem('hideBottomNav', 'false'); // ✅ 로딩 끝났으니 BottomNav 보여줌
      }, remaining);
    };
    if (typeof window !== 'undefined' && !sessionStorage.getItem('visited')) {
      sessionStorage.setItem('visited', 'true');            // 최초 방문 기록
      sessionStorage.setItem('hideBottomNav', 'true');      // BottomNav 숨김
      fetchAll();                                           // ✅ 최초에만 호출
    } else {
      setIsLoading(false);                                  // 로딩 없이 바로 렌더
      sessionStorage.setItem('hideBottomNav', 'false');     // BottomNav 표시
    }
  }, []);
  
  if (isLoading) {
    return (
      <div className="relative min-h-screen w-full max-w-[430px] mx-auto bg-gradient-to-b from-red to-redbrown flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* 배경 이미지 (투명도 + 혼합 모드) */}
        <Image
          src="/bg_loading.png"
          alt="로딩 배경"
          fill
          className="absolute inset-0 object-cover opacity-40 mix-blend-luminosity pointer-events-none z-0"
          priority
        />
  
        {/* 연등 이미지 */}
        <Image
          src="/lotusbeige.png"
          alt="로딩 중"
          width={72}
          height={72}
          className="animate-float opacity-90 transition duration-1000 z-10"
          priority
        />
  
        {/* 로딩 문구 */}
        <p className="mt-6 text-white text-lg font-maruburi animate-fade z-10">
          숨을 깊이 들이쉬고, 마음을 비워보세요.
        </p>
        <p className="mt-2 text-sm text-pink-light font-maruburi animate-fade z-10">
        </p>
      </div>
    );
  }
  
  
  return (
    <>
      <MarbleOverlay />
      <div className="absolute bg-gradient-to-b from-red to-redbrown">
        <main className="min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto px-6 pt">
          <ScrollHeader />

          {/* 상단 홍보 배너 */}
          <div className="w-full h-16 bg-red-light border-[0.5px] border-pink-light rounded-xl flex flex-row items-center pl-1 mt-8 justify-start">
            <Image
              src="/lotusbeige.png"
              alt="lotus"
              width={48}
              height={48}
              className="object-contain border-beige mx-2"
            />
            <div className="flex flex-col">
              <p className="mb-0 text-sm font-medium text-white text-start">
                「부처님께 여쭙기」 기능이 출시되었습니다
              </p>
              <p className="mt-0 text-sm font-base text-pink-light text-start">
                클릭하여 자세히 알아보세요
              </p>
            </div>
          </div>

          {/* 어서오세요 문구 */}
          <div className="w-full rounded-xl flex flex-col items-start pl-1 justify-start">
          <p className="text-2xl font-semibold text-white text-center mt-12">
  어서오세요, {!!userName?.trim() ? `${userName}님` : '불자님'}
</p>
          </div>

          {/* 오늘의 법문 배너 */}
          {title && index !== null && (
            <div
              onClick={() => {
                setBookmark(title, index);
                router.push('/scripture');
              }}
              className="w-full h-16 bg-red-light border-[0.5px] border-pink-light rounded-xl flex flex-row items-center pl-1 mt-4 justify-start cursor-pointer"
            >
              <Image
                src="/lotusbeige.png"
                alt="lotus"
                width={48}
                height={48}
                className="object-contain border-beige mx-2"
              />
              <div className="flex flex-col">
                <p className="mb-0 text-sm font-medium text-white text-start">
                  오늘의 법문 {title}
                </p>
                <p className="mt-0 text-sm font-base text-pink-light text-start line-clamp-1">
                  {sentence || '내용을 불러오는 중입니다.'}
                </p>
              </div>
            </div>
          )}

          {/* 오늘의 수행 영역 */}
          <div className="w-full overflow-x-auto no-scrollbar bg-red-light rounded-xl mt-4 py-4">
            <p className="text font-semibold text-white text-left pl-6">
              오늘의 수행은 🪷
            </p>
            <div className="flex space-x-4 overflow-x-auto no-scrollbar px-4 mt-4 py-2">
              {/* 카드 1 */}
              <div
                onClick={() => router.push('/ask')}
                className="min-w-[240px] h-[360px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
              >
                <div className="h-[280px] w-full relative rounded-2xl overflow-hidden">
                  <Image
                    src="/askvip.png"
                    alt="부처님께 여쭙기"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="flex-1 px-3 py-2">
                  <p className="text-xs text-left text-white font-medium">부처님께 여쭙기</p>
                  <p className="text-xs text-left text-pink-light font-medium">
                    나의 고민에 대해 부처님이라면 어떤 말씀을 하실까요? 인공지능이 부처님의 지혜로 안내합니다
                  </p>
                </div>
              </div>

              {/* 카드 2 */}
              <div
                onClick={() => router.push('/scripture')}
                className="min-w-[240px] h-[360px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
              >
                <div className="h-[280px] w-full relative rounded-2xl overflow-hidden">
                  <Image
                    src="/jumpingdoo.png"
                    alt="호날두께 여쭙기"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="flex-1 px-3 py-2">
                  <p className="text-xs text-left text-white font-medium">호날두께 여쭙기</p>
                  <p className="text-xs text-left text-pink-light font-medium">
                    나의 고민에 대해 호날두라면 어떤 말씀을 하실까요? 인공지능이 호날두의 지혜로 안내합니다
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-[0.5px] opacity-50 bg-[#E0DBCF] mt-6" />

          <p className="text-xs font-medium text-white text-center mt-6 mb-24">
            &ldquo;연등&rdquo;은 누구나 수행하고 위로받을 수 있는 작은 법당입니다.
          </p>
          
        </main>
      </div>
    </>
  );
}
