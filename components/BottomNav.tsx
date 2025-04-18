'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Mountain, Book, MessageCircle, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const navItems = [
    { label: '홈', icon: Mountain, path: '/' },
    { label: '경문', icon: Book, path: '/scripture' },
    { label: '질문', icon: MessageCircle, path: '/ask' },
    {
      label: user ? '내정보' : '로그인',
      icon: UserIcon,
      path: '/me',
      action: async () => {
        if (user) {
          router.push('/me');
        } else {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo:
                typeof window !== 'undefined'
                  ? window.location.origin
                  : 'https://buddha-dusky.vercel.app',
            },
          });
          if (error) alert('로그인 실패');
        }
      },
    },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[64px] bg-white border-t border-red flex justify-around items-center z-50">
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
