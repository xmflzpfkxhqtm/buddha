'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ScrollHeader from '../../../../components/ScrollHeader';
import MarbleOverlay from '../../../../components/Overlay';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useHighlightStore } from '@/stores/useHighlightStore';
import { titleToReaderPath } from '@/lib/scripturePath';
import { supabase } from '@/lib/supabaseClient';
import { formatDisplayTitle } from '@/lib/titleFormatting';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

interface UpdateNote {
  id: number;
  title: string;
  body: string | null;
  published_at: string;
}

const SPLASH_PHRASES = [
  '자기를 바로 봅시다',
  '스스로의 등불을 밝히고,\n법에 의지해 살아라.',
];

export default function Home() {
  const router = useRouter();
  const { setHighlight } = useHighlightStore();
  const { resolvedTheme } = useTheme();

  const [title, setTitle] = useState('');
  const [index, setIndex] = useState<number | null>(null);
  const [sentence, setSentence] = useState('');
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 👈 최소 로딩용 상태
  const [fontReady, setFontReady] = useState(false); // 폰트 로딩 상태
  const [updateNotes, setUpdateNotes] = useState<UpdateNote[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [themeMounted, setThemeMounted] = useState(false);
  const [splashPhrase, setSplashPhrase] = useState(SPLASH_PHRASES[0]);

  // 마운트 후 랜덤 선택. SSR/CSR hydration 미스매치 회피를 위해 첫 렌더는 [0] 으로 통일.
  useEffect(() => {
    setSplashPhrase(SPLASH_PHRASES[Math.floor(Math.random() * SPLASH_PHRASES.length)]);
  }, []);



  useEffect(() => setThemeMounted(true), []);

  // 진입: brand bg (라이트 #551102 / 다크 #3D1B16 = --surface-brand 의 var-swap 결과) + Light 아이콘.
  // 떠날 때: 다음 페이지가 기대하는 색 (라이트 = cream + Dark icons, 다크 = warm dark + Light icons).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!themeMounted) return;
    const isDark = resolvedTheme === 'dark';
    const enterBg = isDark ? '#3D1B16' : '#551102';
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    StatusBar.setBackgroundColor?.({ color: enterBg }).catch(() => {});
    return () => {
      const leaveBg = isDark ? '#342D26' : '#f8f5ee';
      const leaveStyle = isDark ? Style.Light : Style.Dark;
      StatusBar.setStyle({ style: leaveStyle }).catch(() => {});
      StatusBar.setBackgroundColor?.({ color: leaveBg }).catch(() => {});
    };
  }, [themeMounted, resolvedTheme]);

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

      try {
        const getProfile = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;
          const { data: profile } = await supabase
            .from('users').select('username').eq('id', user.id).single();
          return { user, profile };
        };

        const [teachingRes, profileResult, notesRes] = await Promise.all([
          fetch('/api/today-teaching').then((res) => res.json()),
          getProfile(),
          fetch('/api/update-notes').then((res) => res.json()).catch(() => ({ notes: [] })),
        ]);

        setTitle(teachingRes.title);
        setIndex(teachingRes.index);
        setSentence(teachingRes.sentence);
        setUpdateNotes(Array.isArray(notesRes?.notes) ? notesRes.notes : []);

        if (profileResult) {
          const { user, profile } = profileResult;
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
      <div className="relative min-h-screen w-full max-w-[460px] mx-auto bg-gradient-to-b from-accent to-surface-brand flex flex-col items-center justify-center px-6 overflow-hidden">
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
        <p className="mt-6 text-on-brand text-lg font-maruburi animate-fade z-10 text-center whitespace-pre-line">
          {splashPhrase}
        </p>
        <p className="mt-2 text-sm text-on-brand-muted font-maruburi animate-fade z-10">
        </p>
      </div>
    );
  }
  
  
  return (
    <>
      <MarbleOverlay />
      <div className="absolute w-full bg-surface-brand">
        {/* iOS status bar 영역(safe-area-top)은 빨간 bg 가 그대로 채우고, 컨텐츠는 그 아래부터 시작. */}
        <main
          className="min-h-screen w-full max-w-[460px] flex flex-col justify-start items-center mx-auto px-6"
          style={{ paddingTop: 'max(44px, env(safe-area-inset-top))' }}
        >
          <ScrollHeader />

          {/* 업데이트 노트 토글 (Supabase update_notes 테이블에서 관리) */}
          {updateNotes.length > 0 && (
            <div className="w-full mt-4">
              <button
                type="button"
                onClick={() => setNotesOpen((v) => !v)}
                className="w-full h-16 bg-surface-brand-elevated border border-accent-soft dark:border-transparent rounded-xl flex flex-row items-center pl-1 pr-3 justify-start cursor-pointer text-left"
                aria-expanded={notesOpen}
              >
                <Image
                  src="/lotusbeige.png"
                  alt="lotus"
                  width={48}
                  height={48}
                  className="object-contain border-on-brand mx-2"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="mb-0 text-base font-medium text-on-brand truncate">
                    {updateNotes[0].title}
                  </p>
                  <p className="mt-0 text-sm font-base text-on-brand-muted">
                    업데이트 노트 {notesOpen ? '닫기' : '열기'}
                  </p>
                </div>
                <span
                  className={`ml-2 text-on-brand-muted transition-transform duration-200 ${notesOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>

              {notesOpen && (
                <div className="w-full mt-2 bg-surface-brand-elevated border border-accent-soft dark:border-transparent rounded-xl p-4 space-y-4">
                  {updateNotes.map((note) => (
                    <div key={note.id} className="space-y-1">
                      <p className="text-base font-semibold text-on-brand">{note.title}</p>
                      <p className="text-xs text-on-brand-muted">
                        {new Date(note.published_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      {note.body && (
                        <p className="text-sm text-on-brand/90 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                          {note.body}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 어서오세요 문구 */}
          <div className="w-full rounded-xl flex flex-col items-start pl-1 justify-start">
          <p className="font-semibold text-on-brand dark:text-accent text-center mt-4">
  어서오세요, {!!userName?.trim() ? `${userName}님` : '불자님'}
</p>

          </div>
          

          {typeof title === 'string' &&
 title.length > 0 &&
 typeof index === 'number' &&
 !isNaN(index) && (
  <div
    onClick={() => {
      setHighlight(title, index, sentence);
      router.push(titleToReaderPath(title));
    }}
              className="w-full rounded-xl bg-surface-brand-elevated border border-accent-soft dark:border-transparent flex flex-row items-center pl-1 pr-4 py-2 mt-4 justify-start cursor-pointer"
            >
              <Image
                src="/lotusbeige.png"
                alt="lotus"
                width={48}
                height={48}
                className="object-contain border-on-brand mx-2"
              />
              
              <div className="flex flex-col">
                <p className="mb-0 text-base font-semibold text-on-brand text-start">
                  오늘의 법문 📖
                </p>
                <p className="mb-0 text-base font-medium text-on-brand text-start">
                &ldquo;{sentence}&rdquo;
                </p>

                <p className="mt-0 text-sm font-base text-on-brand-muted text-left">
  {formatDisplayTitle(title) || '내용을 불러오는 중입니다.'}
</p>
              </div>
            </div>
          )}

          {/* 오늘의 수행 영역 */}
          <div className="w-full overflow-x-auto no-scrollbar rounded-xl mt-2 py-4">
            <p className="font-semibold text-on-brand dark:text-accent text-left">
              오늘의 수행은 🪷
            </p>
            <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4 py-2 border-b border-accent-soft">
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
                  <p className="text-base text-left text-on-brand dark:text-accent font-medium">부처님께 여쭙기</p>
                  <p className="text-base text-left text-on-brand-muted font-medium">
                    나의 고민에 대해 부처님이라면 어떤 말씀을 하실까요? <br></br>인공지능이 부처님의 지혜로 안내합니다
                  </p>
                </div>
              </div>
              </div>
              <div className="flex space-x-4 overflow-x-auto no-scrollbar mt-4 py-2 border-b border-accent-soft">

              {/* 카드 2 */}
              <div
                onClick={() => router.push('/scripture/v2')}
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
                  <p className="text-base text-left text-on-brand dark:text-accent font-medium">디지털 팔만대장경</p>
                  <p className="text-base text-left text-on-brand-muted font-medium">
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
    <p className="text-base text-left text-on-brand dark:text-accent font-medium">사경하기</p>
    <p className="text-base text-left text-on-brand-muted font-medium">
    붓을 들고 호흡을 고르며 한 획 한 획 마음을 담아봅니다<br />
지금 이 순간에만 머무는 깊은 집중을 경험하세요
    </p>
  </div>
</div>
</div>
          </div>

          <div className="w-full h-[1px] opacity-30 bg-line mt-6" />

          <p className="text-sm font-medium text-on-brand text-center mt-6 mb-24">
            &ldquo;연등&rdquo;은 누구나 수행하고 위로받을 수 있는 작은 법당입니다.
          </p>
          
        </main>
      </div>
    </>
  );
}
