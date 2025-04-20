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

const ITEMS_PER_PAGE = 6;

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [scriptureMap, setScriptureMap] = useState<Record<string, string[]>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const { setBookmark } = useBookmarkStore();
  const router = useRouter();

  const totalPages = Math.ceil(bookmarks.length / ITEMS_PER_PAGE);
  const paginatedBookmarks = bookmarks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">📌 저장한 책갈피</h1>

      {bookmarks.length === 0 ? (
        <p className="text-sm text-gray-500">아직 책갈피가 없습니다.</p>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {paginatedBookmarks.map((bm) => (
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

          {/* ✅ 페이지네이션 */}
          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-sm px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ◀
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`text-sm px-3 py-1 rounded border ${
                  page === currentPage ? 'bg-red-dark text-white' : 'bg-white text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-sm px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ▶
            </button>
          </div>
        </>
      )}
    </main>
  );
}
