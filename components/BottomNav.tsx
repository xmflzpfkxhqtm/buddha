'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Mountain, Book, MessageCircle, User as UserIcon, Brush } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [hide, setHide] = useState(false); // 👈 최초 접속 시 숨김용

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

  // 👇 최초 접속 시 Home에서만 BottomNav 숨기기
  useEffect(() => {
    if (pathname === '/') {
      const isFirstVisit = sessionStorage.getItem('isFirstVisit');
      if (!isFirstVisit) {
        setHide(true); // 하단바 숨김
        sessionStorage.setItem('isFirstVisit', 'true');
        // 3초 후 자동으로 다시 표시
        setTimeout(() => setHide(false), 3000);
      } else {
        setHide(false); // 이미 방문한 경우 항상 보이기
      }
    } else {
      setHide(false); // 다른 페이지에선 항상 보이기
    }
  }, [pathname]);

  const navItems = [
    { label: '홈', icon: Mountain, path: '/' },
    { label: '불경', icon: Book, path: '/scripture' },
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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] h-[72px] bg-white border-t border-red flex justify-around items-center z-30">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            onClick={() => (item.action ? item.action() : router.push(item.path))}
            className={`flex flex-col items-center text-xs transition duration-200 hover:scale-110 ${
              isActive ? 'text-red-light font-semibold' : 'text-red-dark'
            }`}
          >
            <Icon
              size={20}
              className={`mb-1 transition duration-200 ${
                isActive ? 'text-red-light' : 'text-red-dark'
              }`}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
