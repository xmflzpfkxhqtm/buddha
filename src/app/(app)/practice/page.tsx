'use client';

import Link from 'next/link';
import { Timer, Sparkles, Brush } from 'lucide-react';

const CARDS = [
  {
    href: '/practice/meditation',
    icon: Timer,
    title: '명상 타이머',
    desc: '고요한 명상을 위한 타이머와\n명상 일지를 기록해보세요',
    color: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    href: '/practice/yunsang',
    icon: Sparkles,
    title: '목륜상 점보기',
    desc: '점찰선악업보경의 목륜상법으로\n업(業)의 흐름을 살펴보세요',
    color: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    href: '/practice/copy',
    icon: Brush,
    title: '사경',
    desc: '법문을 손으로 좇으며\n마음에 새겨보세요',
    color: 'bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-600 dark:text-green-400',
  },
];

export default function PracticePage() {
  return (
    <main className="w-full max-w-[460px] px-6 pt-6 pb-6 space-y-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.href}
            href={card.href}
            className={`flex items-center gap-5 p-5 rounded-2xl border border-accent-soft ${card.color} hover:opacity-80 active:scale-[0.98] transition-all duration-150`}
          >
            <div className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-white/60 dark:bg-black/20 ${card.iconColor}`}>
              <Icon size={26} />
            </div>
            <div>
              <p className="text-lg font-semibold text-accent">{card.title}</p>
              <p className="text-sm text-accent/70 mt-0.5 whitespace-pre-line leading-snug">
                {card.desc}
              </p>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
