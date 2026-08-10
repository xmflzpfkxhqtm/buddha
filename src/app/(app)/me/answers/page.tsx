'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useAskStore } from '@/stores/askStore';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';
import PaginationControls from '../../../../../components/PaginationControls';
import DeleteConfirmModal from '../../../../../components/DeleteConfirmModal';
import { type TempAnswer } from '@/types/answers';
import { formatScriptureTitle } from '@/lib/titleFormatting';

type Tab = 'general' | 'scripture';

const ITEMS_PER_PAGE = 5;

/** 인용 prefix 가 들어간 question 에서 실제 사용자 질문 부분만 추출 (preview 용). */
function extractUserQuestion(question: string): string {
  const m = question.match(/질문:\n([\s\S]+)$/);
  if (m) return m[1].trim();
  const auto = question.match(/이 구절의 의미를 자세히 알려주세요\.\s*$/);
  if (auto) return '이 구절의 의미를 자세히 알려주세요.';
  return question;
}

/** question prefix 에서 인용된 경전 텍스트 추출. */
function extractCitationText(question: string): string | null {
  const m = question.match(/^다음 경전 구절에 대해 여쭙습니다\.[\s\S]*?\[[^\]]+\]\s*\n"([\s\S]+?)"\s*\n\n/);
  return m ? m[1] : null;
}

function simplifyScriptureCitations(answer: string): string {
  return answer.replace(/『(.+?)』/g, (_, match) => {
    const simplified = match.replace(/_\d+권$/, '');
    return `『${simplified}』`;
  });
}

export default function AnswerPage() {
  const [answers, setAnswers] = useState<TempAnswer[]>([]);
  const [tabCounts, setTabCounts] = useState({ general: 0, scripture: 0 });
  const [tab, setTab] = useState<Tab>('general');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<TempAnswer | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { setParentId } = useAskStore();
  const router = useRouter();
  const userId = useAuthUser();

  useBodyScrollLock(!!selectedItem || !!deleteTargetId);

  const totalCount = tab === 'general' ? tabCounts.general : tabCounts.scripture;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const fetchPage = useCallback(async (t: Tab, page: number, uid: string) => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    const isScripture = t === 'scripture';

    const dataQuery = isScripture
      ? supabase.from('temp_answers')
          .select('id, question, answer, scripture_title, created_at')
          .eq('user_id', uid).eq('is_saved', true)
          .not('scripture_title', 'is', null)
          .order('saved_at', { ascending: false }).range(from, to)
      : supabase.from('temp_answers')
          .select('id, question, answer, scripture_title, created_at')
          .eq('user_id', uid).eq('is_saved', true)
          .is('scripture_title', null)
          .order('saved_at', { ascending: false }).range(from, to);

    const countQuery = isScripture
      ? supabase.from('temp_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid).eq('is_saved', true)
          .not('scripture_title', 'is', null)
      : supabase.from('temp_answers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', uid).eq('is_saved', true)
          .is('scripture_title', null);

    const [{ data }, { count }] = await Promise.all([dataQuery, countQuery]);
    if (data) setAnswers(data as TempAnswer[]);
    if (count !== null) setTabCounts((prev) => ({ ...prev, [t]: count }));
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

  const confirmDelete = async () => {
    if (!deleteTargetId || !userId) return;
    const { error } = await supabase
      .from('temp_answers')
      .update({ is_saved: false })
      .eq('id', deleteTargetId);
    if (error) { alert('삭제에 실패했습니다.'); return; }
    setDeleteTargetId(null);
    const newTotal = totalCount - 1;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / ITEMS_PER_PAGE));
    const nextPage = Math.min(currentPage, newTotalPages);
    setTabCounts((prev) => ({ ...prev, [tab]: newTotal }));
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
      {/* 탭 */}
      <div className="sticky top-0 z-10 bg-surface-elevated flex border-b border-line">
        {renderTab('general', '자유 질문', tabCounts.general)}
        {renderTab('scripture', '경전 질문', tabCounts.scripture)}
      </div>

      {answers.length === 0 ? (
        <div className="pt-10 text-center text-ink-muted">
          <p>{tab === 'general' ? '저장된 자유 질문이 없습니다.' : '저장된 경전 질문이 없습니다.'}</p>
          <p className="mt-1 text-sm">
            {tab === 'general'
              ? '질문 탭에서 부처님께 여쭙고 답변을 저장해보세요.'
              : '경전을 읽다가 구절을 선택해 부처님께 묻고 답변을 저장해보세요.'}
          </p>
        </div>
      ) : (
        <section className="pt-3 pb-10">
          <ul className="divide-y divide-line border-y border-line">
            {answers.map((item) => {
              const userQ = extractUserQuestion(item.question);
              return (
                <li key={item.id} className="py-4">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left block hover:opacity-80 active:opacity-60 transition-opacity"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      {item.scripture_title ? (
                        <p className="font-semibold text-accent text-base flex-1 min-w-0 truncate">
                          {formatScriptureTitle(item.scripture_title)}
                        </p>
                      ) : (
                        <p className="font-semibold text-accent text-base flex-1 min-w-0 truncate">
                          나의 질문
                        </p>
                      )}
                      <span className="text-xs text-ink-subtle whitespace-nowrap shrink-0 mt-1">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed mb-1">
                      {userQ}
                    </p>
                    <p className="text-sm text-ink line-clamp-3 leading-relaxed">
                      {item.answer}
                    </p>
                  </button>
                  <div className="flex justify-end items-center gap-4 mt-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(item.id)}
                      className="text-accent-soft hover:text-accent transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </section>
      )}

      {/* 상세 모달 */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-[400px] max-h-[80vh] overflow-y-auto p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              aria-label="닫기"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-lg text-ink-subtle hover:bg-surface-sunken hover:text-ink transition-colors"
            >
              <X size={20} />
            </button>

            <p className="text-xs text-ink-subtle mb-1 pr-9">
              {new Date(selectedItem.created_at).toLocaleDateString()}
            </p>
            {selectedItem.scripture_title && (
              <>
                <p className="text-sm font-semibold text-accent-soft mb-2 pr-9">
                  📖 {formatScriptureTitle(selectedItem.scripture_title)}
                </p>
                {extractCitationText(selectedItem.question) && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-surface-sunken text-sm text-ink-muted leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {extractCitationText(selectedItem.question)}
                  </div>
                )}
              </>
            )}

            <p className="text-sm font-semibold text-ink-muted mb-1">나의 질문</p>
            <p className="text-sm text-ink mb-4 whitespace-pre-wrap leading-relaxed">
              {extractUserQuestion(selectedItem.question)}
            </p>

            <p className="text-sm font-semibold text-ink-muted mb-1">부처님 말씀</p>
            <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed font-maruburi">
              {simplifyScriptureCitations(selectedItem.answer)}
            </p>

            <button
              type="button"
              onClick={() => {
                setParentId(selectedItem.id);
                setSelectedItem(null);
                router.push('/ask');
              }}
              className="w-full mt-6 h-11 rounded-lg bg-accent text-on-brand text-sm font-semibold hover:bg-accent-soft transition-colors"
            >
              문답을 이어갑니다
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </main>
  );
}
