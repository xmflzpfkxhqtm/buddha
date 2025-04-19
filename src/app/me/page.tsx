'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useBookmarkStore } from '../../stores/useBookmarkStore';
import { useRouter } from 'next/navigation';

interface Answer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface Bookmark {
  id: string;
  user_id: string;
  title: string;
  index: number;
  created_at: string;
  sentence?: string;
}

export default function MePage() {
  type MyUser = User & {
    user_metadata?: {
      full_name?: string;
      [key: string]: unknown;
    };
  };

  const [user, setUser] = useState<MyUser | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptureMap, setScriptureMap] = useState<Record<string, string[]>>({});

  const { setBookmark } = useBookmarkStore();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user;
      setUser(currentUser);
      if (currentUser) {
        fetchAnswers(currentUser.id);
        fetchBookmarks(currentUser.id);
      }
    });
  }, []);

  const fetchAnswers = async (userId: string) => {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error) setAnswers(data as Answer[]);
  };

  const fetchBookmarks = async (userId: string) => {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false, nullsLast: true });

    if (!error && data) {
      setBookmarks(data as Bookmark[]);

      const titles = [...new Set(data.map((bm: Bookmark) => bm.title))];
      const contentMap: Record<string, string[]> = {};

      for (const title of titles) {
        const res = await fetch(`/api/scripture?title=${encodeURIComponent(title)}`);
        const json = await res.json();
        const full = json.content || '';
        const lines = full.match(/[^.!?\n]+[.!?\n]*/g) || [full];
        contentMap[title] = lines;
      }

      setScriptureMap(contentMap);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleBookmarkClick = (title: string, index: number) => {
    setBookmark(title, index);
    setTimeout(() => {
      router.push('/scripture');
    }, 0);
  };

  const handleDeleteBookmark = async (bookmarkId: string) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', bookmarkId);
    if (!error) {
      setBookmarks(prev => prev.filter(bm => bm.id !== bookmarkId));
    }
  };

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-4 py-10">
      {user && (
        <div className="w-full flex flex-col items-center mb-6">
          <p className="text-sm text-gray-700 font-semibold">{user.user_metadata?.full_name}</p>
          <p className="text-xs text-gray-500 mb-2">{user.email}</p>
          <button onClick={handleLogout} className="text-xs underline text-red-dark hover:text-red">
            로그아웃
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : (
        <>
          <div className="w-full mb-10">
            <h2 className="text-base font-bold text-left text-red mb-2">📌 저장한 책갈피</h2>
            {bookmarks.length === 0 ? (
              <p className="text-sm text-gray-500">아직 책갈피가 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {bookmarks.map((bm) => (
                  <li key={bm.id} className="bg-white rounded-xl border shadow-sm">
                    <button
                      onClick={() => handleBookmarkClick(bm.title, bm.index)}
                      className="w-full px-4 pt-3 pb-2 text-left"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-red-dark">
                            📖 {bm.title.length > 30 ? bm.title.slice(0, 30) + '...' : bm.title}
                          </span>
                          <span className="text-sm text-gray-700 font-medium">{bm.index + 1}행</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBookmark(bm.id);
                          }}
                          className="text-xs text-red-dark hover:text-red ml-2"
                        >
                          삭제
                        </button>
                      </div>
                      <p className="text-sm text-gray-700">
                        {scriptureMap[bm.title]?.[bm.index] || '내용을 불러올 수 없습니다.'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="w-full mb-6">
            <h2 className="text-base font-bold text-left text-red mb-2">🪷 내가 저장한 말씀들</h2>
            <p className="text-sm text-gray-600 mb-4 text-left">
              당신의 마음에 남은 질문과 부처님의 답변입니다.
            </p>
          </div>

          <div className="w-full space-y-6">
            {answers.map((item) => (
              <div key={item.id} className="p-4 rounded-xl shadow-md border border-red bg-white">
                <div className="mb-2">
                  <p className="text-xs text-gray-500">🕰 {new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="mb-3">
                  <p className="font-bold text-red mb-1">🪷 부처님 말씀</p>
                  <p className="whitespace-pre-wrap text-sm text-black">{item.answer}</p>
                </div>
                <div>
                  <p className="font-bold text-red mb-1">📜 나의 질문</p>
                  <p className="text-sm text-black">「{item.question}」</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
