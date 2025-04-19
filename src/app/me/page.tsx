'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);

  const [weeklyQuestionCount, setWeeklyQuestionCount] = useState(0);
  const [mostReadTitle, setMostReadTitle] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setUser(user);

      if (user) {
        // 전체 수
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

        // 이번 주 질문 수
        const { count: questionCount } = await supabase
          .from('answers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte(
            'created_at',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          );
        setWeeklyQuestionCount(questionCount || 0);

        // 이번 주 가장 많이 본 경전
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
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-6 py-10 flex flex-col gap-6">
      {/* 📊 이번 주 통계 */}
      {user && (
        <div className="bg-white border shadow rounded-xl p-4 mb-2 text-sm text-gray-700">
          <p className="font-semibold text-red mb-1">📊 이번 주 요약</p>
          <p>📖 가장 많이 본 경전: <strong>{mostReadTitle || '없음'}</strong></p>
          <p>🪷 질문 횟수: <strong>{weeklyQuestionCount}개</strong></p>
        </div>
      )}

      {/* 사용자 정보 */}
      {user && (
        <div className="flex flex-col items-center mb-2">
          <p className="text-sm text-gray-700 font-semibold">{user.user_metadata?.full_name}</p>
          <p className="text-xs text-gray-500 mb-1">{user.email}</p>
          <button
            onClick={handleLogout}
            className="text-xs underline text-red-dark hover:text-red"
          >
            로그아웃
          </button>
        </div>
      )}

      {/* 메뉴 카드 */}
      <div
        onClick={() => router.push('/me/bookmarks')}
        className="cursor-pointer p-4 bg-white rounded-xl shadow border"
      >
        <p className="text-lg font-bold text-red-dark">📌 저장한 책갈피</p>
        <p className="text-sm text-gray-600 mt-1">경전의 구절을 저장한 목록입니다.</p>
        <p className="text-xs text-gray-500 mt-1">{bookmarkCount}개</p>
      </div>

      <div
        onClick={() => router.push('/me/answers')}
        className="cursor-pointer p-4 bg-white rounded-xl shadow border"
      >
        <p className="text-lg font-bold text-red-dark">🪷 내가 저장한 말씀들</p>
        <p className="text-sm text-gray-600 mt-1">당신의 질문과 부처님의 답변입니다.</p>
        <p className="text-xs text-gray-500 mt-1">{answerCount}개</p>
      </div>

      <div
        onClick={() => router.push('/me/feedback')}
        className="cursor-pointer p-4 bg-white rounded-xl shadow border"
      >
        <p className="text-lg font-bold text-blue-700">💬 피드백 보내기</p>
        <p className="text-sm text-gray-600 mt-1">불편한 점이나 바라는 점을 알려주세요.</p>
      </div>

    </main>
  );
}
