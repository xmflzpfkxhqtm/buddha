'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState<CopyNote | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const router = useRouter();
  useBodyScrollLock(!!selected || !!deleteId);

  const totalPages = Math.max(1, Math.ceil(notes.length / ITEMS_PER_PAGE));
  const paginated = notes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data, error } = await supabase
        .from('copy_notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .order('updated_at', { ascending: false });
      if (error) {
        console.error(error);
        return;
      }
      setNotes(data as CopyNote[]);
    })();
  }, [router]);

  const goPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('copy_notes').delete().eq('id', deleteId);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== deleteId));
    setDeleteId(null);
  };

  return (
    <main className="px-4 pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen [overflow-wrap:anywhere]">
      {notes.length === 0 ? (
        <div className="pt-10 text-center text-ink-muted">
          <p>아직 저장된 사경노트가 없습니다.</p>
          <p className="mt-1 text-sm">사경 탭에서 경전을 따라 적고 노트를 저장해보세요.</p>
        </div>
      ) : (
        <section className="pt-3 pb-10">
          <p className="text-sm text-ink-muted mb-2">총 {notes.length}개 사경노트</p>
          <ul className="divide-y divide-line border-y border-line">
            {paginated.map((n) => (
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

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => goPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors disabled:text-ink-subtle disabled:hover:bg-transparent"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-ink-muted tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-accent hover:bg-accent/5 active:bg-accent/10 transition-colors disabled:text-ink-subtle disabled:hover:bg-transparent"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
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

      {/* 삭제 확인 모달 */}
      {deleteId && (
        <div
          onClick={() => setDeleteId(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-xl p-6 w-full max-w-[360px] text-center shadow-xl"
          >
            <p className="text-base font-semibold text-ink mb-5">정말 사경노트를 삭제할까요?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 h-11 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 h-11 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
