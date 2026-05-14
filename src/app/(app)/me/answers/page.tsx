'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAskStore } from '@/stores/askStore';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

interface TempAnswer {
  id: string;
  question: string;
  answer: string;
  scripture_title: string | null;
  created_at: string;
}

type Tab = 'general' | 'scripture';
const ITEMS_PER_PAGE = 5;

function formatScriptureTitle(title: string): string {
  return title.replace(/_K\d{4}/, '').replace(/_/g, ' ');
}

/** 인용 prefix 가 들어간 question 에서 실제 사용자 질문 부분만 추출 (preview 용). */
function extractUserQuestion(question: string): string {
  // buildCitedQuestion 형식: "다음 경전 구절에 대해 여쭙습니다.\n\n[제목]\n\"...\"\n\n질문:\n<사용자 질문>"
  const m = question.match(/질문:\n([\s\S]+)$/);
  if (m) return m[1].trim();
  // 질문 라벨 없이 자동 prefix 만 있는 경우 (사용자 질문 비었을 때)
  const auto = question.match(/이 구절의 의미를 자세히 알려주세요\.\s*$/);
  if (auto) return '이 구절의 의미를 자세히 알려주세요.';
  return question;
}

/** question prefix 에서 인용된 경전 텍스트 추출. 형식: ...[제목]\n"인용 텍스트"\n\n... */
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
  const [tab, setTab] = useState<Tab>('general');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<TempAnswer | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const { setParentId } = useAskStore();
  const router = useRouter();
  useBodyScrollLock(!!selectedItem || !!deleteTargetId);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: rows } = await supabase
        .from('temp_answers')
        .select('id, question, answer, scripture_title, created_at')
        .eq('user_id', user.id)
        .eq('is_saved', true)
        .order('saved_at', { ascending: false });
      if (rows) setAnswers(rows as TempAnswer[]);
    });
  }, []);

  // 탭 전환 시 페이지 reset
  useEffect(() => setCurrentPage(1), [tab]);

  const generalAnswers = useMemo(
    () => answers.filter((a) => !a.scripture_title),
    [answers],
  );
  const scriptureAnswers = useMemo(
    () => answers.filter((a) => !!a.scripture_title),
    [answers],
  );
  const visible = tab === 'general' ? generalAnswers : scriptureAnswers;

  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const paginated = visible.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const { error } = await supabase
      .from('temp_answers')
      .update({ is_saved: false })
      .eq('id', deleteTargetId);
    if (error) {
      alert('삭제에 실패했습니다.');
      return;
    }
    setAnswers((prev) => prev.filter((a) => a.id !== deleteTargetId));
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
      {/* 탭 */}
      <div className="sticky top-0 z-10 bg-surface-elevated flex border-b border-line">
        {renderTab('general', '자유 질문', generalAnswers.length)}
        {renderTab('scripture', '경전 질문', scriptureAnswers.length)}
      </div>

      {visible.length === 0 ? (
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
            {paginated.map((item) => {
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

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
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
                onClick={() => handlePageChange(currentPage + 1)}
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

      {/* 삭제 확인 */}
      {deleteTargetId && (
        <div
          onClick={() => setDeleteTargetId(null)}
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-elevated rounded-xl p-6 w-full max-w-[360px] text-center shadow-xl"
          >
            <p className="text-base font-semibold text-ink mb-5">정말 삭제할까요?</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
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
