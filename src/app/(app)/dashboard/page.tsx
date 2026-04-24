'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ScrollHeader from '../../../../components/ScrollHeader';
import MarbleOverlay from '../../../../components/Overlay';
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
  const [fontReady, setFontReady] = useState(false); // 폰트 로딩 상태

  function formatDisplayTitle(rawTitle: string): string {
    return rawTitle
      .replace(/_GPT\d+(\.\d+)?번역/, '') // GPT 번역 제거
      .replace(/_/g, ' ');                // _를 공백으로
  }
  
  useEffect(() => {
    // 폰트 로딩 감지 (iOS WKWebView 등에서 resolve가 지연/누락되는 경우 대비 fallback)
    let done = false;
    const markReady = () => {
      if (done) return;
      done = true;
      setFontReady(true);
    };

    if (document.fonts) {
      document.fonts.ready.then(markReady).catch(markReady);
    } else {
      markReady();
    }

    const fallback = setTimeout(markReady, 1500);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    const visited = sessionStorage.getItem('visited');
    const isFirstVisit = !visited;
  
    // ✅ isLoading 초기값: 첫 방문이면 true, 아니면 false
    setIsLoading(isFirstVisit);
  
    if (isFirstVisit) {
      sessionStorage.setItem('visited', 'true');
      sessionStorage.setItem('hideBottomNav', 'true');
    } else {
      sessionStorage.setItem('hideBottomNav', 'false');
    }
  
    const fetchAll = async () => {
      const start = Date.now();

      console.log('✅ fetchAll 실행됨');

      try {
        const [teachingRes, userRes] = await Promise.all([
          fetch('/api/today-teaching').then((res) => res.json()),
          supabase.auth.getUser(),
        ]);

        console.log('✅ API 응답:', teachingRes);

        setTitle(teachingRes.title);
        setIndex(teachingRes.index);
        setSentence(teachingRes.sentence);
        console.log('✅ title:', teachingRes.title);
        console.log('✅ index:', teachingRes.index);
        console.log('✅ sentence:', teachingRes.sentence);

        const user = userRes.data.user;

        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single();

          setUserName(profile?.username ?? user.user_metadata?.full_name ?? null);
        }
      } catch (err) {
        console.warn('[dashboard] fetchAll 실패:', err);
      } finally {
        const elapsed = Date.now() - start;
        const remaining = Math.max(1000 - elapsed, 0); // ✅ 첫 방문 때만 쓰일 최소 로딩 시간

        // ✅ 첫 방문이면 약간 기다렸다 로딩 해제 (실패해도 보장)
        if (isFirstVisit) {
          setTimeout(() => {
            setIsLoading(false);
            sessionStorage.setItem('hideBottomNav', 'false');
          }, remaining);
        }
      }
    };
  
    fetchAll(); // ✅ 무조건 API 호출
  }, []);
  
    
  if (isLoading || !fontReady) {
    return (
      <div className="relative min-h-screen w-full max-w-[460px] mx-auto bg-gradient-to-b from-red to-redbrown flex flex-col items-center justify-center px-6 overflow-hidden">
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
        마음을 바라봅니다
        </p>
        <p className="mt-2 text-sm text-pink-light font-maruburi animate-fade z-10">
        </p>
      </div>
    );
  }
  
  
  return (
    <>
      <MarbleOverlay />
      <div className="absolute w-full bg-[#551102]">
        <main className="min-h-screen w-full max-w-[460px] flex flex-col justify-start items-center mx-auto px-6 pt">
          <ScrollHeader />

          {/* 상단 홍보 배너 */}
          <div
  onClick={() => router.push('/ask')}
  className="w-full h-16  bg-[#4d0e00] border border-red-light rounded-xl flex flex-row items-center pl-1 mt-4 justify-start cursor-pointer"
>
            <Image
              src="/lotusbeige.png"
              alt="lotus"
              width={48}
              height={48}
              className="object-contain border-beige mx-2"
            />
            <div className="flex flex-col">
              <p className="mb-0 text-base font-medium text-white text-start">
                부처님께 여쭙기 AI 기능이 출시되었습니다
              </p>
              <p className="mt-0 text-sm font-base text-pink-light text-start">
                클릭하여 자세히 알아보세요
              </p>
            </div>
          </div>

          {/* 어서오세요 문구 */}
          <div className="w-full rounded-xl flex flex-col items-start pl-1 justify-start">
          <p className="font-semibold text-white text-center mt-4">
  어서오세요, {!!userName?.trim() ? `${userName}님` : '불자님'}
</p>          

          </div>
          

          {typeof title === 'string' &&
 title.length > 0 &&
 typeof index === 'number' &&
 !isNaN(index) && (
  <div
    onClick={() => {
      setBookmark(title, index);
      router.push('/scripture');
    }}
              className="w-full rounded-xl bg-[#4d0e00] border border-red-light flex flex-row items-center pl-1 pr-4 py-2 mt-4 justify-start cursor-pointer"
            >
              <Image
                src="/lotusbeige.png"
                alt="lotus"
                width={48}
                height={48}
                className="object-contain border-beige mx-2"
              />
              
              <div className="flex flex-col">
                <p className="mb-0 text-base font-semibold text-white text-start">
                  오늘의 법문 📖 
                </p>
                <p className="mb-0 text-base font-medium text-white text-start">
                &ldquo;{sentence}&rdquo;
                </p>

                <p className="mt-0 text-sm font-base text-pink-light text-left">
  {formatDisplayTitle(title) || '내용을 불러오는 중입니다.'} 
</p>
              </div>
            </div>
          )}

          {/* 오늘의 수행 영역 */}
          <div className="w-full overflow-x-auto no-scrollbar rounded-xl mt-2 py-4">
            <p className="font-semibold text-white text-left">
              오늘의 수행은 🪷
            </p>
            <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4 py-2 border-b border-red-light">
              {/* 카드 1 */}
              <div
                onClick={() => router.push('/ask')}
                className="min-w-[320px] h-[240px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
              >
                <div className="h-[280px] w-full relative rounded-2xl overflow-hidden">
                  <Image
                    src="/banner_1.png"
                    alt="부처님께 여쭙기"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="flex-1 px-3 py-2">
                  <p className="text-base text-left text-white font-medium">부처님께 여쭙기</p>
                  <p className="text-base text-left text-pink-light font-medium">
                    나의 고민에 대해 부처님이라면 어떤 말씀을 하실까요? <br></br>인공지능이 부처님의 지혜로 안내합니다
                  </p>
                </div>
              </div>
              </div>
              <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4 py-2">

              {/* 카드 2 */}
              <div
                onClick={() => router.push('/scripture')}
                className="min-w-[320px] h-[240px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
              >
                <div className="h-[280px] w-full relative rounded-2xl overflow-hidden">
                  <Image
                    src="/banner_2.jpg"
                    alt="디지털 팔만대장경"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
                <div className="flex-1 px-3 py-2">
                  <p className="text-base text-left text-white font-medium">디지털 팔만대장경</p>
                  <p className="text-base text-left text-pink-light font-medium">
                  알기 쉬운 현대어로 풀어쓴 불경 모음<br></br> 방대한 경전의 모든 말씀을 쉽고 편안한 말로 담았습니다
                  </p>
                </div>
              </div>
            </div>
            <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4 py-2">

{/* 카드 3 */}
<div
  onClick={() => router.push('/copy')}
  className="min-w-[320px] h-[240px] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition"
>
  <div className="h-[280px] w-full relative rounded-2xl overflow-hidden">
    <Image
      src="/copy.jpg"
      alt="사경하기"
      fill
      className="object-cover"
      priority
    />
  </div>
  <div className="flex-1 px-3 py-2">
    <p className="text-base text-left text-white font-medium">사경하기</p>
    <p className="text-base text-left text-pink-light font-medium">
    붓을 들고 호흡을 고르며 한 획 한 획 마음을 담아봅니다<br />
지금 이 순간에만 머무는 깊은 집중을 경험하세요
    </p>
  </div>
</div>
</div>
          </div>

          <div className="w-full h-[1px] opacity-30 bg-[#E0DBCF] mt-6" />

          <p className="text-sm font-medium text-white text-center mt-6 mb-24">
            &ldquo;연등&rdquo;은 누구나 수행하고 위로받을 수 있는 작은 법당입니다.
          </p>
          
        </main>
      </div>
    </>
  );
}
