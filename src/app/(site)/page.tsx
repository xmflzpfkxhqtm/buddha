/* ────────────────────────────────────────────────
   src/app/(site)/page.tsx
   ──────────────────────────────────────────────── */
   'use client';

   import Image from 'next/image';
   import { useEffect, useRef, useState } from 'react';
   import { Capacitor } from '@capacitor/core';
   import { useRouter } from 'next/navigation';
   
   /* ---------- 공통 UI ---------- */
   function Header({ show }: { show: boolean }) {
     return (
       <header className={`
            hidden md:flex                    
             /* ← mobile에서는 통째로 숨김 */
fixed top-0 left-0 w-full z-50 px-4 py-4 md:px-8 lg:px-12
                           flex items-center justify-between text-white
                           transition-all duration-700 ${show ? '' : '-translate-y-6 opacity-0'}`}>
         <span className="text-lg font-semibold">연등</span>
         <nav className="hidden md:flex gap-6 text-sm text-white">
           <a href="#features"  className="hover:text-pink-light">기능</a>
           <a href="#download"  className="hover:text-pink-light">다운로드</a>
         </nav>
       </header>
     );
   }
   
   function Footer() {
     return (
       <footer className="w-full py-4 text-zinc-400 bg-[#000000] text-center text-xs">
        문의 choe.junekyung@gmail.com <br/>
         © {new Date().getFullYear()} Yeondeung. All rights reserved.
       </footer>
     );
   }
   
   /* ---------- 메인 ---------- */
   export default function LandingPage() {
     const router = useRouter();
     const [mount, setMount] = useState(false);
   
     /* WebView 접속 시 /dashboard */
     useEffect(() => {
       const ua = navigator.userAgent.toLowerCase();
       const native = typeof Capacitor !== 'undefined' && Capacitor.getPlatform?.() !== 'web';
       if (ua.includes('yeondeungapp') || native) router.replace('/dashboard');
     }, [router]);
   
     useEffect(() => { setMount(true); }, []);
   
     /* ---------- 모바일 가로 슬라이드 ---------- */
     const sectionRef = useRef<HTMLElement>(null);
     const trackRef   = useRef<HTMLDivElement>(null);
   
     useEffect(() => {
       if (window.innerWidth >= 768) return;                // 데스크톱은 early-return
   
       const section = sectionRef.current!;
       const track   = trackRef.current!;
       const slides  = cards.length;
       const vw      = window.innerWidth;
       const totalW  = vw * slides;
       track.style.width = `${totalW}px`;
   
       const onScroll = () => {
         const rect      = section.getBoundingClientRect();
         const vh        = window.innerHeight;
         if (rect.top > 0) {                                // 섹션이 뷰포트에 닿기 전
           track.style.transform = 'translateX(0)';
           return;
         }
         const maxY      = rect.height - vh;                // sticky 구간 세로 길이
         const walkedY   = Math.min(Math.max(-rect.top, 0), maxY);
         const progress  = walkedY / maxY;                  // 0 → 1
         track.style.transform = `translateX(-${(totalW - vw) * progress}px)`;
       };
   
       onScroll();
       addEventListener('scroll', onScroll, { passive: true });
       addEventListener('resize', onScroll);
       return () => {
         removeEventListener('scroll', onScroll);
         removeEventListener('resize', onScroll);
       };
     }, []);
   
     return (
       <div className="scroll-smooth">
         <Header show={mount} />
   
         {/* ---------- Hero ---------- */}
         <section className="min-h-screen flex flex-col items-center justify-center bg-[#000000] text-pink-light pt-4 px-6">
           <h1 className={`text-5xl md:text-6xl text-center font-extrabold mb-6 transition-all duration-700
                           ${mount ? '' : 'translate-y-10 opacity-0'}`}>
             마음 속 연등을<br className="md:hidden" /> 밝혀보세요
           </h1>
           <Image src="/graphic.png" alt="" width={260} height={260}
                  className={`mb-8 transition-opacity duration-700 ${mount ? 'opacity-100' : 'opacity-0'}`}
                  priority />
           <p className={`text-lg text-zinc-300 mb-10 text-center transition-all duration-700 delay-200
                          ${mount ? '' : 'translate-y-6 opacity-0'}`}>
             팔만대장경 기반 AI 부처님이<br />당신의 물음에 응답합니다
           </p>
           <div className="flex py-4 gap-4">
           <a href="https://apps.apple.com/us/app/id6745544277" target="_blank" rel="noopener"
              className="flex items-center gap-3 bg-white text-black rounded-xl px-5 py-3 shadow-lg">
             <Image src="/appstore.svg" alt="" width={20} height={20} />
             <span className="font-medium">App Store</span>
           </a>
           <a
          href="https://play.google.com/store/apps/details?id=com.lotuslantern.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-3 bg-white text-black rounded-xl px-4 py-2 md:px-5 md:py-3 shadow-lg hover:scale-[1.03] transition"
        >
          <Image src="/google-play.svg" alt="Google Play" width={20} height={20} />
          <span className="text-base md:text-base font-medium">Google Play</span>
        </a></div>
           <a href="#features" className="text-lg pt-12 animate-bounce">내려서 보기 ↓</a>
           
         </section>
   
         {/* ---------- Features ---------- */}
         <section id="features" className="bg-white">
           {/* ----- 데스크톱(세로 카드) ----- */}
           <div className="hidden md:flex flex-col gap-24 max-w-2xl mx-auto py-16 px-6">
             {cards.map((c, i) => (
               <div key={i} className={`flex items-center gap-12 ${i % 2 ? 'flex-row-reverse' : ''}`}>
                 <PhoneShot src={c.img} alt={c.alt} />
                 <div className="flex-1 text-lg leading-relaxed">
                   <h3 className="text-2xl text-black font-semibold mb-3">{c.title}</h3>
                   <p className="text-red-dark">{c.desc}</p>
                 </div>
               </div>
             ))}
           </div>
   
           {/* ----- 모바일(가로 슬라이드) ----- */}
           <section
             ref={sectionRef}
             className="relative md:hidden"
             style={{ height: `calc(100vh + ${cards.length} * 100vw)` }}
           >
             <div className="sticky top-0 h-screen pt-12 flex items-center overflow-hidden">
               <div ref={trackRef} className="flex h-full will-change-transform">
                 {cards.map((c, i) => (
                   <div key={i} className="w-screen flex flex-col items-center gap-6 px-6">
                     <PhoneShot src={c.img} alt={c.alt} />
                     <div className="text-center max-w-xs mx-auto">
                       <h3 className="pt-4 text-xl text-black font-bold mb-2">{c.title}</h3>
                       <p className="text-base text-red-dark">{c.desc}</p>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </section>
         </section>
   
         {/* ---------- Download ---------- */}
         <section id="download" className="min-h-screen flex flex-col items-center justify-center bg-[#000000] text-white px-6">
         <Image src="/graphic.png" alt="" width={320} height={320}
                  className={`mb-8 transition-opacity duration-700 ${mount ? 'opacity-100' : 'opacity-0'}`}
                  priority />
           <p className="mb-4 text-lg">지금 마음공부 시작하기</p>
           <div className="flex gap-4">
           <a href="https://apps.apple.com/us/app/id6745544277" target="_blank" rel="noopener"
              className="flex items-center gap-3 bg-white text-black rounded-xl px-5 py-3 shadow-lg">
             <Image src="/appstore.svg" alt="" width={20} height={20} />
             <span className="font-medium">App Store</span>
           </a>
           <a
          href="https://play.google.com/store/apps/details?id=com.lotuslantern.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 md:gap-3 bg-white text-black rounded-xl px-4 py-2 md:px-5 md:py-3 shadow-lg hover:scale-[1.03] transition"
        >
          <Image src="/google-play.svg" alt="Google Play" width={20} height={20} />
          <span className="text-base md:text-base font-medium">Google Play</span>
        </a></div>
         </section>
   
         <Footer />
       </div>
     );
   }
   
   /* ---------- 서브 컴포넌트 ---------- */
   function PhoneShot({ src, alt }: { src: string; alt: string }) {
    return (
      <div className="w-[280px] md:w-[270px] lg:w-[300px] rounded-xl overflow-hidden shadow-lg">
        {/* width·height를 **원본 비율** 그대로 적어 주면
           object-cover 로 잘려도 해상도 손실 없이 렌더링됩니다 */}
        <Image
          src={src}
          alt={alt}
          width={1080}
          height={2340}
          sizes="(min-width:1024px) 300px,
                 (min-width:768px)  270px,
                 280px"
          quality={90}
          className="object-cover"
          priority
        />
      </div>
    );
  }
       
   /* ---------- 카드 데이터 ---------- */
   const cards = [
     { img: '/ss-ask.png',     alt: '부처님께 여쭙기', title: '부처님께 여쭙기',
       desc: '마음 속에 있는 고민을 부처님께 여쭙고, 그 답변을 들을 수 있어요.' },
     { img: '/ss-answer.png',      alt: '부처님 답변', title: '오롯이 나를 위한 지혜',
       desc: '나의 물음에 맞춰 AI 부처님이 오롯이 나를 위한 지혜를 내어드립니다.' },
     { img: '/ss-scripture.png', alt: '디지털 팔만대장경', title: '디지털 팔만대장경',
       desc: '5천만 자 이상의 불경을 쉬운 말로 담은 디지털 팔만대장경을 만나보세요.' },
       { img: '/ss-text.png', alt: '책갈피와 불경 듣기', title: '귀로 듣고 책갈피에 저장',
        desc: '불경을 읽거나 듣고 책갈피에 저장해 언제든 다시 꺼내볼 수 있어요.' }
   ];
   