'use client';

import { useCallback, useEffect, useState } from 'react';
import { useHighlightStore } from '@/stores/useHighlightStore';
import { titleToReaderPath } from '@/lib/scripturePath';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useRouter } from 'next/navigation';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import PaginationControls from '../../../../../components/PaginationControls';
import DeleteConfirmModal from '../../../../../components/DeleteConfirmModal';
import { formatDisplayTitle } from '@/lib/titleFormatting';
import { type DisplayHighlight as Highlight } from '@/types/highlights';

const ITEMS_PER_PAGE = 5;
const HL_SELECT = 'id, user_id, title, start_sentence, end_sentence, start_char_offset, end_char_offset, anchor_start_text, highlight_text, memo, created_at';

/** 미리보기 텍스트 우선순위: highlight_text > anchor_start_text > fallback */
function getPreview(h: Highlight): string {
  if (h.highlight_text && h.highlight_text.trim()) return h.highlight_text;
  if (h.anchor_start_text && h.anchor_start_text.trim()) return h.anchor_start_text;
  return '내용을 불러올 수 없습니다.';
}

type Tab = 'all' | 'memo';

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [tabCounts, setTabCounts] = useState({ all: 0, memo: 0 });
  const [tab, setTab] = useState<Tab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [memoTarget, setMemoTarget] = useState<Highlight | null>(null);
  const [memoInput, setMemoInput] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { setHighlight } = useHighlightStore();
  const router = useRouter();
  const userId = useAuthUser();

  useBodyScrollLock(!!deleteTargetId || !!memoTarget);

  const totalCount = tab === 'all' ? tabCounts.all : tabCounts.memo;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const fetchPage = useCallback(async (t: Tab, page: number, uid: string) => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const dataQuery = t === 'memo'
      ? supabase.from('highlights').select(HL_SELECT)
          .eq('user_id', uid).not('memo', 'is', null).neq('memo', '')
          .order('created_at', { ascending: false }).range(from, to)
      : supabase.from('highlights').select(HL_SELECT)
          .eq('user_id', uid)
          .order('created_at', { ascending: false }).range(from, to);

    const countAllQuery = supabase.from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid);

    const countMemoQuery = supabase.from('highlights')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid).not('memo', 'is', null).neq('memo', '');

    const [{ data }, { count: allCount }, { count: memoCount }] = await Promise.all([
      dataQuery, countAllQuery, countMemoQuery,
    ]);

    if (data) setHighlights(data as Highlight[]);
    setTabCounts({
      all: allCount ?? 0,
      memo: memoCount ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchPage(tab, currentPage, userId);
  }, [userId, tab, currentPage, fetchPage]);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const goToReader = (title: string, index: number) => {
    setHighlight(title, index);
    router.push(titleToReaderPath(title));
  };

  const openMemoModal = (h: Highlight) => {
    setMemoTarget(h);
    setMemoInput(h.memo || '');
  };

  const saveMemo = async () => {
    if (!memoTarget || !userId) return;
    const { error } = await supabase
      .from('highlights')
      .update({ memo: memoInput })
      .eq('id', memoTarget.id);
    if (error) { alert('메모 저장에 실패했습니다.'); return; }
    setMemoTarget(null);
    setMemoInput('');
    fetchPage(tab, currentPage, userId);
  };

  const deleteMemo = async (h: Highlight) => {
    if (!userId) return;
    const { error } = await supabase.from('highlights').update({ memo: null }).eq('id', h.id);
    if (error) { alert('메모 삭제에 실패했습니다.'); return; }
    fetchPage(tab, currentPage, userId);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId || !userId) return;
    const { error } = await supabase.from('highlights').delete().eq('id', deleteTargetId);
    if (error) { alert('삭제에 실패했습니다.'); return; }
    setDeleteTargetId(null);
    const newTotal = totalCount - 1;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / ITEMS_PER_PAGE));
    const nextPage = Math.min(currentPage, newTotalPages);
    if (nextPage !== currentPage) {
      setCurrentPage(nextPage);
    } else {
      fetchPage(tab, nextPage, userId);
    }
  };

  const renderTab = (id: Tab, label: string, count: number) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => handleTabChange(id)}
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
        {renderTab('all', '전체', tabCounts.all)}
        {renderTab('memo', '메모', tabCounts.memo)}
      </div>

      {highlights.length === 0 ? (
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
            {highlights.map((h) => (
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
