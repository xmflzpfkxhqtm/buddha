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
  memo?: string;
}

const ITEMS_PER_PAGE = 5;

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [scriptureMap, setScriptureMap] = useState<Record<string, string[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [memoTarget, setMemoTarget] = useState<Bookmark | null>(null);
  const [memoInput, setMemoInput] = useState('');

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

  const openMemoModal = (bm: Bookmark) => {
    setMemoTarget(bm);
    setMemoInput(bm.memo || '');
  };

  const saveMemo = async () => {
    if (!memoTarget) return;
    const { error } = await supabase
      .from('bookmarks')
      .update({ memo: memoInput })
      .eq('id', memoTarget.id);

    if (!error) {
      setBookmarks((prev) =>
        prev.map((bm) =>
          bm.id === memoTarget.id ? { ...bm, memo: memoInput } : bm
        )
      );
      setMemoTarget(null);
      setMemoInput('');
    } else {
      alert('메모 저장에 실패했습니다.');
    }
  };

  const deleteMemo = async (bm: Bookmark) => {
    const { error } = await supabase
      .from('bookmarks')
      .update({ memo: null })
      .eq('id', bm.id);

    if (!error) {
      setBookmarks((prev) =>
        prev.map((b) => (b.id === bm.id ? { ...b, memo: undefined } : b))
      );
    } else {
      alert('메모 삭제에 실패했습니다.');
    }
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">📌 저장한 책갈피</h1>

      {bookmarks.length === 0 ? (
        <p className="text-base text-gray-500">아직 책갈피가 없습니다.</p>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {paginatedBookmarks.map((bm) => (
              <li
                key={bm.id}
                onClick={() => handleClick(bm.title, bm.index)}
                className="bg-white p-4 rounded-xl shadow cursor-pointer border"
              >
                {/* 1행 */}
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-red-dark text-base truncate">
                    📖 {bm.title} – {bm.index + 1}행
                  </p>
                  <span className="text-base ml-4 text-gray-400 whitespace-nowrap">
                    {new Date(bm.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* 2행 */}
                <div className="flex justify-between items-start">
                  <p className="text-base text-gray-700 w-[70%]">
                    {scriptureMap[bm.title]?.[bm.index] || '내용을 불러올 수 없습니다.'}
                  </p>
                  <div className="flex gap-2">
                    {!bm.memo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMemoModal(bm);
                        }}
                        className="text-base text-red hover:underline"
                      >
                        메모하기
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(bm.id);
                      }}
                      className="text-base text-red-light hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 3행: 메모 존재 시 */}
                {bm.memo && (
  <div className="mt-3 border-t border-gray-200 pt-2">
    <div className="flex justify-between items-start">
      <p className="text-sm text-gray-600 whitespace-pre-wrap w-[70%] leading-snug">
        ✏️ {bm.memo}
      </p>
      <div className="flex gap-2 text whitespace-nowrap items-start mt-[-2px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openMemoModal(bm);
          }}
          className="text-gray hover:underline"
        >
          수정
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteMemo(bm);
          }}
          className="text-red hover:underline"
        >
          메모 삭제
        </button>
      </div>
    </div>
  </div>
)}
          
</li>
            ))}
          </ul>

          {/* 페이지네이션 */}
          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-base px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ◀
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`text-base px-3 py-1 rounded border ${
                  page === currentPage ? 'bg-red text-white' : 'bg-white text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-base px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ▶
            </button>
          </div>
        </>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (
        <div
          onClick={() => setDeleteTargetId(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-[90%] max-w-[360px] text-center shadow-xl"
          >
            <p className="text-lg font-semibold text-red mb-4">정말 책갈피를 삭제할까요?</p>
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 border rounded-lg text-base text-gray-600"
              >
                아니오
              </button>
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from('bookmarks')
                    .delete()
                    .eq('id', deleteTargetId);
                  if (!error) {
                    setBookmarks((prev) => prev.filter((bm) => bm.id !== deleteTargetId));
                    setDeleteTargetId(null);
                  } else {
                    alert('삭제에 실패했습니다.');
                  }
                }}
                className="px-4 py-2 bg-red-light text-white rounded-lg text-base"
              >
                예, 삭제합니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메모 입력 모달 */}
      {memoTarget && (
        <div
          onClick={() => setMemoTarget(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-[90%] max-w-[360px] shadow-xl"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-3">메모하기</h2>
            <textarea
              rows={4}
              className="w-full border rounded p-2 text-sm text-gray-800"
              value={memoInput}
              onChange={(e) => setMemoInput(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setMemoTarget(null)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600"
              >
                취소
              </button>
              <button
                onClick={saveMemo}
                className="px-4 py-2 bg-red-light text-white rounded-lg text-sm"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
