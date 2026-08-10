'use client';

import { useEffect, useMemo, useState } from 'react';
import { useHighlightStore } from '@/stores/useHighlightStore';
import { titleToReaderPath } from '@/lib/scripturePath';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useListWithPagination } from '@/hooks/useListWithPagination';
import { useRouter } from 'next/navigation';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import PaginationControls from '../../../../../components/PaginationControls';
import DeleteConfirmModal from '../../../../../components/DeleteConfirmModal';
import { formatDisplayTitle } from '@/lib/titleFormatting';
import { type DisplayHighlight as Highlight } from '@/types/highlights';


/** 미리보기 텍스트 우선순위:
 *   highlight_text (정확히 선택한 텍스트) > anchor_start_text (sentence 첫 50자, 옛 row) > '내용 없음' */
function getPreview(h: Highlight): string {
  if (h.highlight_text && h.highlight_text.trim()) return h.highlight_text;
  if (h.anchor_start_text && h.anchor_start_text.trim()) return h.anchor_start_text;
  return '내용을 불러올 수 없습니다.';
}

type Tab = 'all' | 'memo';

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [memoTarget, setMemoTarget] = useState<Highlight | null>(null);
  const [memoInput, setMemoInput] = useState('');

  const { setHighlight } = useHighlightStore();
  const router = useRouter();
  const userId = useAuthUser();

  const memoHighlights = useMemo(
    () => highlights.filter((h) => h.memo && h.memo.trim()),
    [highlights],
  );
  const visible = tab === 'all' ? highlights : memoHighlights;

  const { currentPage, setCurrentPage, totalPages, paginated, handlePageChange, deleteTargetId, setDeleteTargetId } = useListWithPagination(visible);
  useBodyScrollLock(!!deleteTargetId || !!memoTarget);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('highlights')
      .select('id, user_id, title, start_sentence, end_sentence, start_char_offset, end_char_offset, anchor_start_text, highlight_text, memo, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data: rows }) => { if (rows) setHighlights(rows); });
  }, [userId]);

  useEffect(() => setCurrentPage(1), [tab, setCurrentPage]);

  const goToReader = (title: string, index: number) => {
    setHighlight(title, index);
    router.push(titleToReaderPath(title));
  };

  const openMemoModal = (h: Highlight) => {
    setMemoTarget(h);
    setMemoInput(h.memo || '');
  };

  const saveMemo = async () => {
    if (!memoTarget) return;
    const { error } = await supabase
      .from('highlights')
      .update({ memo: memoInput })
      .eq('id', memoTarget.id);
    if (error) {
      alert('메모 저장에 실패했습니다.');
      return;
    }
    setHighlights((prev) =>
      prev.map((h) => (h.id === memoTarget.id ? { ...h, memo: memoInput } : h)),
    );
    setMemoTarget(null);
    setMemoInput('');
  };

  const deleteMemo = async (h: Highlight) => {
    const { error } = await supabase
      .from('highlights')
      .update({ memo: null })
      .eq('id', h.id);
    if (error) {
      alert('메모 삭제에 실패했습니다.');
      return;
    }
    setHighlights((prev) =>
      prev.map((b) => (b.id === h.id ? { ...b, memo: undefined } : b)),
    );
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const { error } = await supabase.from('highlights').delete().eq('id', deleteTargetId);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setHighlights((prev) => prev.filter((h) => h.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  const renderTab = (id: Tab, label: string, count: number) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTab(id)}
        className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
          active
            ? 'border-accent text-accent'
            : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        {label} <span className={active ? 'text-accent-soft' : 'text-ink-subtle'}>{count}</span>
      </button>
    );
  };

  return (
    <main className="px-4 pb-20 max-w-[460px] mx-auto bg-surface-elevated min-h-screen [overflow-wrap:anywhere]">
      {/* 탭 — 전체 / 메모 */}
      <div className="sticky top-0 z-10 bg-surface-elevated flex border-b border-line">
        {renderTab('all', '전체', highlights.length)}
        {renderTab('memo', '메모', memoHighlights.length)}
      </div>

      {visible.length === 0 ? (
        <div className="pt-10 text-center text-ink-muted">
          <p>{tab === 'all' ? '아직 하이라이트가 없습니다.' : '메모가 있는 하이라이트가 없습니다.'}</p>
          <p className="mt-1 text-sm">
            {tab === 'all'
              ? '경전을 읽다가 구절을 길게 눌러 하이라이트와 메모를 남겨보세요.'
              : '하이라이트한 구절을 다시 눌러 메모를 추가해보세요.'}
          </p>
        </div>
      ) : (
        <section className="pt-3 pb-10">
          <ul className="divide-y divide-line border-y border-line">
            {paginated.map((h) => (
              <li key={h.id} className="py-4">
                <button
                  type="button"
                  onClick={() => goToReader(h.title, h.start_sentence)}
                  className="w-full text-left block hover:opacity-80 active:opacity-60 transition-opacity"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="font-semibold text-accent text-base flex-1 min-w-0 truncate">
                      {formatDisplayTitle(h.title)}
                    </p>
                    <span className="text-xs text-ink-subtle whitespace-nowrap shrink-0 mt-1">
                      {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-ink-muted line-clamp-3 leading-relaxed">
                    {getPreview(h)}
                  </p>
                  {h.memo && (
                    <p className="mt-2 px-3 py-2 rounded-md bg-surface-sunken text-sm text-ink whitespace-pre-wrap line-clamp-3 leading-relaxed">
                      {h.memo}
                    </p>
                  )}
                </button>
                <div className="flex justify-end items-center gap-4 mt-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openMemoModal(h)}
                    className="text-ink-muted hover:text-accent transition-colors"
                  >
                    {h.memo ? '메모 수정' : '메모'}
                  </button>
                  {h.memo && (
                    <button
                      type="button"
                      onClick={() => deleteMemo(h)}
                      className="text-ink-muted hover:text-accent transition-colors"
                    >
                      메모 삭제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(h.id)}
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

      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        message="정말 하이라이트를 삭제할까요?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      {memoTarget && (
        <div
          onClick={() => setMemoTarget(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-xl p-6 w-full max-w-[360px] shadow-xl"
          >
            <h2 className="text-base font-semibold text-ink mb-3">메모하기</h2>
            <textarea
              rows={4}
              className="w-full rounded-lg border border-line bg-surface-elevated p-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none transition-colors resize-none"
              value={memoInput}
              onChange={(e) => setMemoInput(e.target.value)}
              placeholder="이 구절에 대한 생각이나 메모를 적어보세요"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setMemoTarget(null)}
                className="px-4 h-10 rounded-lg border border-line text-sm text-ink-muted hover:bg-surface-sunken transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveMemo}
                className="px-4 h-10 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
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
