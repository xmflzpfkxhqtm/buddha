'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ChevronRight } from 'lucide-react';
import { useScriptureFavoritesStore } from '@/stores/useScriptureFavoritesStore';

export default function MePage() {
  const router = useRouter();
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [copyCount,     setCopyCount]     = useState(0);   // ← 추가

  const [userName, setUserName] = useState<string | null>(null);
  const favoriteCount = useScriptureFavoritesStore((s) => s.groups.length);
  const loadFavorites = useScriptureFavoritesStore((s) => s.load);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace('/login');
        return;
      }

      loadFavorites(user.id);

      // ✅ 이름 추출
      const { data: profile } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();
    
    setUserName(profile?.username ?? user.user_metadata?.full_name ?? null);
    
      const { data: bookmarks } = await supabase
        .from('highlights')
        .select('id')
        .eq('user_id', user.id);
        const { count: savedAnswerCount } = await supabase
        .from('temp_answers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_saved', true);
        const { count: savedCopyCount } = await supabase
        .from('copy_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true);       // 완료본만

      
      setAnswerCount(savedAnswerCount || 0);
      setBookmarkCount(bookmarks?.length || 0);
      setCopyCount(savedCopyCount || 0);
    };

    checkAuthAndFetchData();
  }, [router, loadFavorites]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-surface-elevated px-6 py-6 flex flex-col gap-6">
      {userName && (
        <p className="text-lg text-accent font-semibold mx-4 mb-2">{userName}님, 평온한 하루 되십시오 🙏</p>
      )}

      <ul className="rounded-xl">
        <li
          onClick={() => router.push('/me/profile')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold  text-accent">프로필 관리</p>
            <p className="text-sm text-ink-muted">이름, 이메일, 기본 정보를 확인하거나 수정합니다.</p>
          </div>
          <ChevronRight size={16} className="text-ink-subtle" />
        </li>

        <li
          onClick={() => router.push('/me/favorites')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold text-accent">즐겨찾기</p>
            <p className="text-sm text-ink-muted">즐겨찾기한 경전 목록입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-ink-subtle text-sm">
            {favoriteCount}개 <ChevronRight size={16} />
          </div>
        </li>

        <li
          onClick={() => router.push('/me/highlights')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold text-accent">하이라이트</p>
            <p className="text-sm text-ink-muted">경전에서 표시한 구절과 메모를 모아 봅니다.</p>
          </div>
          <div className="flex items-center gap-2 text-ink-subtle text-sm">
            {bookmarkCount}개 <ChevronRight size={16} />
          </div>
        </li>

        <li
          onClick={() => router.push('/me/answers')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold text-accent">내가 저장한 말씀들</p>
            <p className="text-sm text-ink-muted">당신의 질문과 부처님의 답변입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-ink-subtle text-sm">
            {answerCount}개 <ChevronRight size={16} />
          </div>
        </li>


        <li
          onClick={() => router.push('/me/copies')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold text-accent">나의 사경노트</p>
            <p className="text-sm text-ink-muted">당신의 질문과 부처님의 답변입니다.</p>
          </div>
          <div className="flex items-center gap-2 text-ink-subtle text-sm">
            {copyCount}개 <ChevronRight size={16} />
          </div>
        </li>


      
        <li
  onClick={() => router.push('/me/settings')}
  className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
>
  <div>
    <p className="font-semibold text-accent">설정</p>
    <p className="text-sm text-ink-muted">알림, 소리 등 앱 환경을 조정합니다.</p>
  </div>
  <ChevronRight size={16} className="text-ink-subtle" />
</li>
        <li
          onClick={() => router.push('/me/feedback')}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface"
        >
          <div>
            <p className="font-semibold  text-accent">제안 및 문의 보내기</p>
            <p className="text-sm text-ink-muted">불편한 점이나 바라는 점을 알려주세요.</p>
          </div>
          <ChevronRight size={16} className="text-ink-subtle" />
        </li>


        <li
          onClick={handleLogout}
          className="cursor-pointer px-4 py-4 flex items-center justify-between hover:bg-surface-sunken"
        >
          <div>
            <p className="font-semibold text-accent-soft">로그아웃</p>
            <p className="text-sm text-ink-muted">계정에서 로그아웃합니다.</p>
          </div>
          <ChevronRight size={16} className="text-ink-subtle" />
        </li>
       

      </ul>
    </main>
  );
}
