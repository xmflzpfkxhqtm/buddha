'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Mountain, MessageCircle, User } from 'lucide-react';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: '홈', icon: Mountain, path: '/' },
    { label: '질문', icon: MessageCircle, path: '/ask' },
    { label: '내정보', icon: User, path: '/me' },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[64px] bg-white border-t border-red flex justify-around items-center z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
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
