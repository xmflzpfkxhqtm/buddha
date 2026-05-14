'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Mountain, Book, MessageCircle, User as UserIcon, Brush } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useChromeStore } from '@/stores/useChromeStore';
import { useScriptureNavStore } from '@/stores/useScriptureNavStore';

const SCRIPTURE_ROOT = '/scripture/v2';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [hide, setHide] = useState(false); // 👈 최초 접속 시 숨김용
  const chromeVisible = useChromeStore((s) => s.visible); // Layer 3 reader chrome 동기화
  const lastScripturePath = useScriptureNavStore((s) => s.lastPath);
  const setLastScripturePath = useScriptureNavStore((s) => s.setLastPath);

  useEffect(() => {
    // 사용자 정보 가져오기
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // /scripture/* 안에 있을 때마다 마지막 위치 저장 (search 쿼리 포함 — 옛 ?title= URL 호환)
  useEffect(() => {
    if (pathname && pathname.startsWith('/scripture')) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      setLastScripturePath(`${pathname}${search}`);
    }
  }, [pathname, setLastScripturePath]);

  // 👇 최초 접속 시 Home에서만 BottomNav 숨기기
  useEffect(() => {
    if (pathname === '/') {
      const isFirstVisit = sessionStorage.getItem('isFirstVisit');
      if (!isFirstVisit) {
        setHide(true); // 하단바 숨김
        sessionStorage.setItem('isFirstVisit', 'true');
        // 3초 후 자동으로 다시 표시
        setTimeout(() => setHide(false), 1000);
      } else {
        setHide(false); // 이미 방문한 경우 항상 보이기
      }
    } else {
      setHide(false); // 다른 페이지에선 항상 보이기
    }
  }, [pathname]);

  // 불경 탭 동작:
  //  - 다른 탭 → 불경: 마지막 본 scripture 화면으로 (없으면 Layer 1)
  //  - 이미 /scripture/* 안: Layer 1 으로 reset (인스타·트위터 패턴)
  const handleScriptureTap = () => {
    if (pathname && pathname.startsWith('/scripture')) {
      router.push(SCRIPTURE_ROOT);
    } else {
      router.push(lastScripturePath ?? SCRIPTURE_ROOT);
    }
  };

  const navItems = [
    { label: '홈', icon: Mountain, path: '/dashboard' },
    { label: '불경', icon: Book, path: SCRIPTURE_ROOT, action: handleScriptureTap },
    { label: '질문', icon: MessageCircle, path: '/ask' },
    { label: '사경', icon: Brush, path: '/copy' },

    {
      label: user ? '내정보' : '로그인',
      icon: UserIcon,
      path: user ? '/me' : '/login',
      action: () => {
        router.push(user ? '/me' : '/login');
      },
    },
  ];

  if (hide) return null;

  return (
    <nav
      // chrome hide 시 화면 밖으로 (e-book 표준). 첫 tap = chrome show, 둘째 tap = navigate.
      // opacity 0 + click 받기 패턴은 "안 보이는데 navigate" 가 버그처럼 느껴진다는 사용자 feedback 반영.
      className={`fixed bottom-0 left-1/2 select-none w-full max-w-[460px] h-[84px] bg-surface-elevated border-t border-accent-soft flex justify-around items-center z-30 transition-transform duration-200 ${
        chromeVisible ? '-translate-x-1/2' : '-translate-x-1/2 translate-y-full'
      }`}
    >
      {navItems.map((item) => {
        const isActive =
          item.label === '불경'
            ? pathname?.startsWith('/scripture') ?? false
            : pathname === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            onClick={(e) => {
              // navigate 후 main 의 chrome tap-toggle 까지 bubble 되지 않게 차단
              e.stopPropagation();
              if (item.action) item.action();
              else router.push(item.path);
            }}
            className={`flex flex-col items-center text-sm transition duration-200 hover:scale-110 ${
              isActive ? 'text-accent-soft font-semibold' : 'text-accent'
            }`}
          >
            <Icon
              size={24}
              className={`mb-1 transition duration-200 ${
                isActive ? 'text-accent-soft' : 'text-accent'
              }`}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
