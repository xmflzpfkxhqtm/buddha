'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { ChevronRight } from 'lucide-react';

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [weeklyQuestionCount, setWeeklyQuestionCount] = useState(0);
  const [mostReadTitle, setMostReadTitle] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      // ✅ 로그인 안 된 경우 로그인 페이지로 이동
      if (!user) {
        router.replace('/login');
        return;
      }

      setUser(user);

      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id);
      const { data: answers } = await supabase
        .from('answers')
        .select('id')
        .eq('user_id', user.id);
      setBookmarkCount(bookmarks?.length || 0);
      setAnswerCount(answers?.length || 0);

      const { count: questionCount } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte(
          'created_at',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      setWeeklyQuestionCount(questionCount || 0);

      const { data: weeklyBookmarks } = await supabase
        .from('bookmarks')
        .select('title')
        .eq('user_id', user.id)
        .gte(
          'created_at',
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );

      if (weeklyBookmarks) {
        const countMap: Record<string, number> = {};
        for (const b of weeklyBookmarks) {
          countMap[b.title] = (countMap[b.title] || 0) + 1;
        }
        const mostViewed = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0];
        setMostReadTitle(mostViewed?.[0] || null);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); // ✅ 로그아웃 후 메인으로 이동
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-6 py-10 flex flex-col gap-6">
     

      {/* 메뉴 리스트 */}
      <ul className="rounded-xl">
        {/* ➕ 프로필 */}
        <li
          onClick={() => router.push('/me/profile')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-gray-800">👤 프로필 관리</p>
            <p className="text-sm text-gray-600">이름, 이메일, 기본 정보를 확인하거나 수정합니다.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </li>

        {/* 저장한 책갈피 */}
        <li
          onClick={() => router.push('/me/bookmarks')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-red-dark">📌 저장한 책갈피</p>
            <p className="text-sm text-gray-600">경전의 구절을 저장한 목록입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            {bookmarkCount}개 <ChevronRight size={16} />
          </div>
        </li>

        {/* 내가 저장한 말씀들 */}
        <li
          onClick={() => router.push('/me/answers')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-red-dark">🪷 내가 저장한 말씀들</p>
            <p className="text-sm text-gray-600">당신의 질문과 부처님의 답변입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            {answerCount}개 <ChevronRight size={16} />
          </div>
        </li>

        {/* 피드백 */}
        <li
          onClick={() => router.push('/me/feedback')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-blue-700">💬 피드백 보내기</p>
            <p className="text-sm text-gray-600">불편한 점이나 바라는 점을 알려주세요.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </li>

        {/* 로그아웃 */}
        <li
          onClick={handleLogout}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-red-dark">🚪 로그아웃</p>
            <p className="text-sm text-gray-600">계정에서 로그아웃합니다.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </li>
      </ul>
       {/* 📊 이번 주 통계 */}
       {user && (
        <div className="rounded-xl p-4 text-sm text-gray-700">
          <p className="font-semibold text-red mb-2">📊 이번 주 요약</p>
          <p>📖 가장 많이 본 경전: <strong>{mostReadTitle || '없음'}</strong></p>
          <p>🪷 질문 횟수: <strong>{weeklyQuestionCount}개</strong></p>
        </div>
      )}
    </main>
  );
}
