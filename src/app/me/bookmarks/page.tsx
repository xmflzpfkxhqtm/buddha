'use client';

import { useEffect, useState } from 'react';
import { useBookmarkStore } from '@/stores/useBookmarkStore';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Bookmark {
  id: string;
  user_id: string;
  title: string;
  index: number;
  created_at: string;
}

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [scriptureMap, setScriptureMap] = useState<Record<string, string[]>>({});
  const { setBookmark } = useBookmarkStore();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (user) {
        const { data: bookmarkData } = await supabase
          .from('bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (bookmarkData) {
          setBookmarks(bookmarkData);
          const titles = [...new Set(bookmarkData.map((bm) => bm.title))];
          const map: Record<string, string[]> = {};

          for (const title of titles) {
            const res = await fetch(`/api/scripture?title=${encodeURIComponent(title)}`);
            const json = await res.json();
            const lines = (json.content || '').match(/[^.!?\n]+[.!?\n]*/g) || [json.content || ''];
            map[title] = lines;
          }

          setScriptureMap(map);
        }
      }
    });
  }, []);

  const handleClick = (title: string, index: number) => {
    setBookmark(title, index);
    router.push('/scripture');
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">📌 저장한 책갈피</h1>
      {bookmarks.length === 0 ? (
        <p className="text-sm text-gray-500">아직 책갈피가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {bookmarks.map((bm) => (
            <li
              key={bm.id}
              onClick={() => handleClick(bm.title, bm.index)}
              className="bg-white p-4 rounded-xl shadow cursor-pointer border"
            >
              <p className="font-semibold text-red-dark mb-1">
                📖 {bm.title} – {bm.index + 1}행
              </p>
              <p className="text-sm text-gray-700">
                {scriptureMap[bm.title]?.[bm.index] || '내용을 불러올 수 없습니다.'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
