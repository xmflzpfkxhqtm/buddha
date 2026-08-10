'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import PaginationControls from '../../../../../components/PaginationControls';
import DeleteConfirmModal from '../../../../../components/DeleteConfirmModal';

interface CopyNote {
  id: string;
  title: string;
  thumb_url: string | null;
  memo: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 5;

export default function MyCopyNotesPage() {
  const [notes, setNotes] = useState<CopyNote[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<CopyNote | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const router = useRouter();
  const userId = useAuthUser();

  useBodyScrollLock(!!selected || !!deleteId);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const fetchPage = useCallback(async (page: number, uid: string) => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const [{ data, error }, { count }] = await Promise.all([
      supabase.from('copy_notes').select('*')
        .eq('user_id', uid).eq('completed', true)
        .order('updated_at', { ascending: false }).range(from, to),
      supabase.from('copy_notes').select('id', { count: 'exact', head: true })
        .eq('user_id', uid).eq('completed', true),
    ]);
    if (error) { console.error(error); return; }
    if (data) setNotes(data as CopyNote[]);
    if (count !== null) setTotalCount(count);
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) { router.push('/login'); return; }
    fetchPage(currentPage, userId);
  }, [userId, currentPage, fetchPage, router]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const confirmDelete = async () => {
    if (!deleteId || !userId) return;
    const { error } = await supabase.from('copy_notes').delete().eq('id', deleteId);
    if (error) { alert('삭제에 실패했습니다.'); return; }
    setDeleteId(null);
    // 현재 페이지가 비어서 이전 페이지로 가야 하는 경우 처리
    const newTotal = totalCount - 1;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / ITEMS_PER_PAGE));
    const nextPage = Math.min(currentPage, newTotalPages);
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    } else {
      fetchPage(nextPage, userId);
    }
    setTotalCount(newTotal);
  };

  return (
    <main className="px-4 pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen [overflow-wrap:anywhere]">
      {totalCount === 0 && notes.length === 0 ? (
        <div className="pt-10 text-center text-ink-muted">
          <p>아직 저장된 사경노트가 없습니다.</p>
          <p className="mt-1 text-sm">사경 탭에서 경전을 따라 적고 노트를 저장해보세요.</p>
        </div>
      ) : (
        <section className="pt-3 pb-10">
          <p className="text-sm text-ink-muted mb-2">총 {totalCount}개 사경노트</p>
          <ul className="divide-y divide-line border-y border-line">
            {notes.map((n) => (
              <li key={n.id} className="py-4">
                <button
                  type="button"
                  onClick={() => setSelected(n)}
                  className="w-full text-left flex items-start gap-3 hover:opacity-80 active:opacity-60 transition-opacity"
                >
                  {/* 썸네일 */}
                  <div className="shrink-0 w-16 h-16 rounded-lg bg-surface-sunken overflow-hidden flex items-center justify-center">
                    {n.thumb_url ? (
                      <Image
                        src={n.thumb_url}
                        alt={n.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-ink-subtle">없음</span>
                    )}
                  </div>
                  {/* 메타 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="font-semibold text-accent text-base flex-1 min-w-0 truncate">
                        {n.title}
                      </p>
                      <span className="text-xs text-ink-subtle whitespace-nowrap shrink-0 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {n.memo && (
                      <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                        {n.memo}
                      </p>
                    )}
                  </div>
                </button>
                {/* 삭제 액션 */}
                <div className="flex justify-end mt-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setDeleteId(n.id)}
                    className="text-accent-soft hover:text-accent transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </section>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-[400px] max-h-[80vh] overflow-y-auto p-5 relative"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="닫기"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken hover:text-ink transition-colors"
            >
              <X size={20} />
            </button>

            <p className="text-xs text-ink-subtle mb-1 pr-9">
              {new Date(selected.created_at).toLocaleDateString()}
            </p>
            <h2 className="text-lg font-semibold text-accent mb-3 pr-9">{selected.title}</h2>

            {selected.thumb_url ? (
              <Image
                src={selected.thumb_url}
                alt={selected.title}
                width={400}
                height={400}
                className="w-full h-auto rounded-lg mb-4"
              />
            ) : (
              <p className="text-center text-ink-subtle py-10">이미지가 없습니다</p>
            )}

            {selected.memo && (
              <div className="mt-2">
                <p className="text-sm font-semibold text-ink-muted mb-1">메모</p>
                <p className="whitespace-pre-wrap text-ink text-sm leading-relaxed">
                  {selected.memo}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteId}
        message="정말 사경노트를 삭제할까요?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
