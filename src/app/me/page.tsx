'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight } from 'lucide-react';

export default function MePage() {
  const router = useRouter();
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      // ✅ 이름 추출
      const fullName = user.user_metadata?.full_name;
      setUserName(fullName ?? null);

      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select('id')
        .eq('user_id', user.id);
        const { count: savedAnswerCount } = await supabase
        .from('temp_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_saved', true);
      
      setAnswerCount(savedAnswerCount || 0);
      
      setBookmarkCount(bookmarks?.length || 0);
    };

    checkAuthAndFetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-white px-6 py-10 flex flex-col gap-6">
      {userName && (
        <p className="text-lg text-red font-semibold mx-4 mb-2">{userName}님, 성불하십쇼 🙏</p>
      )}

      <ul className="rounded-xl">
        <li
          onClick={() => router.push('/me/profile')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-beige"
        >
          <div>
            <p className="font-semibold text-gray-800">👤 프로필 관리</p>
            <p className="text-sm text-gray-600">이름, 이메일, 기본 정보를 확인하거나 수정합니다.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </li>

        <li
          onClick={() => router.push('/me/bookmarks')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-beige"
        >
          <div>
            <p className="font-semibold text-red-dark">📌 저장한 책갈피</p>
            <p className="text-sm text-gray-600">경전의 구절을 저장한 목록입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            {bookmarkCount}개 <ChevronRight size={16} />
          </div>
        </li>

        <li
          onClick={() => router.push('/me/answers')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-beige"
        >
          <div>
            <p className="font-semibold text-red-dark">🪷 내가 저장한 말씀들</p>
            <p className="text-sm text-gray-600">당신의 질문과 부처님의 답변입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            {answerCount}개 <ChevronRight size={16} />
          </div>
        </li>
      
        <li
  onClick={() => router.push('/me/settings')}
  className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-beige"
>
  <div>
    <p className="font-semibold text-gray-800">⚙️ 설정</p>
    <p className="text-sm text-gray-600">알림, 소리 등 앱 환경을 조정합니다.</p>
  </div>
  <ChevronRight size={16} className="text-gray-400" />
</li>
        <li
          onClick={() => router.push('/me/feedback')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-beige"
        >
          <div>
            <p className="font-semibold text-blue-700">💬 제안 및 문의 보내기</p>
            <p className="text-sm text-gray-600">불편한 점이나 바라는 점을 알려주세요.</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </li>


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
    </main>
  );
}
