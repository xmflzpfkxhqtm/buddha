'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface CopyNote {
  id: string;
  title: string;
  thumb_url: string | null;
  memo: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 6;

export default function MyCopyNotesPage() {
  const [notes, setNotes] = useState<CopyNote[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<CopyNote | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const router = useRouter();

  const totalPages = Math.ceil(notes.length / ITEMS_PER_PAGE);
  const paginated = notes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  /* ---------- 데이터 로딩 ---------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login'); // 로그인 필요
        return;
      }

      const { data, error } = await supabase
        .from('copy_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)        // 완료본만
        .order('updated_at', { ascending: false });

      if (error) {
        console.error(error);
        return;
      }
      setNotes(data as CopyNote[]);
    })();
  }, [router]);

  /* ---------- 페이지 이동 ---------- */
  const goPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  /* ---------- 렌더 ---------- */
  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">🖼 나의 사경노트</h1>

      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">아직 저장된 사경노트가 없습니다.</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 mb-6">
            {paginated.map((n) => (
              <li
                key={n.id}
                onClick={() => setSelected(n)}
                className="relative h-[300px] rounded-xl shadow border bg-white overflow-hidden cursor-pointer flex flex-col"
              >
                {/* 상단 바: 제목 + 삭제 */}
                <div className="flex justify-between items-center px-3 py-2 text-sm text-gray-700 font-semibold">
                  <span className="truncate">{n.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(n.id);
                    }}
                    className="text-red hover:underline ml-2"
                  >
                    삭제
                  </button>
                </div>

                {/* 썸네일 */}
                <div className="flex-1 flex items-center justify-center">
                  {n.thumb_url ? (
                    <img
                      src={n.thumb_url}
                      alt={n.title}
                      className="object-cover w-full h-full rounded-b-xl"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-500">
                      NO&nbsp;IMAGE
                    </div>
                  )}
                </div>

                {/* 하단: 날짜 */}
                <div className="px-3 py-2 text-xs text-gray-400">
                  {new Date(n.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>

          {/* 페이지네이션 */}
          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => goPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-sm px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ◀
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={`text-base px-3 py-1 rounded border ${
                  p === currentPage ? 'bg-red text-white' : 'bg-white text-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => goPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-base px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ▶
            </button>
          </div>
        </>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-4 relative"
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-3 text-gray-400 hover:text-black text-xl"
            >
              ×
            </button>

            <p className="text-sm text-gray-500 text-right mb-2">
              {new Date(selected.created_at).toLocaleDateString()}
            </p>

            <h2 className="text-lg font-semibold text-red mb-2">{selected.title}</h2>

            {selected.thumb_url ? (
              <img
                src={selected.thumb_url}
                alt={selected.title}
                className="w-full rounded mb-4"
              />
            ) : (
              <p className="text-center text-gray-400 mb-4">이미지가 없습니다</p>
            )}

            {selected.memo && (
              <>
                <p className="text-base font-semibold text-red mb-1">메모</p>
                <p className="whitespace-pre-wrap text-gray-800">{selected.memo}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteId && (
        <div
          onClick={() => setDeleteId(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-6 w-[90%] max-w-[360px] text-center shadow-xl"
          >
            <p className="text-lg font-semibold text-red mb-4">
              정말 삭제하시겠습니까?
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600"
              >
                아니오
              </button>
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from('copy_notes')
                    .delete()
                    .eq('id', deleteId);
                  if (!error) {
                    setNotes((prev) => prev.filter((n) => n.id !== deleteId));
                    setDeleteId(null);
                  } else {
                    alert('삭제에 실패했습니다.');
                  }
                }}
                className="px-4 py-2 bg-red-light text-white rounded-lg text-sm"
              >
                예, 삭제합니다
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
