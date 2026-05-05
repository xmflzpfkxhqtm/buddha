'use client';

import { RefObject, useEffect } from 'react';

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

interface ScriptureModalProps {
  selected: string;
  smoothCenter: (idx: number, instant?: boolean) => void;
  setSelected: (title: string) => void;
  onClose: () => void;
  search: string;
  setSearch: (s: string) => void;
  modalTab: 'title' | 'content' | 'global';
  setModalTab: (t: 'title' | 'content' | 'global') => void;
  groupedTitles: Record<string, string[]>;
  usedInitials: Set<string>;
  initialFilter: string;
  setInitialFilter: (s: string) => void;
  setBookmarkPending: (pending: { title: string; index: number } | null) => void;  // ✅ 추가
  expandedBase: string | null;
  setExpandedBase: (s: string | null) => void;
  formatDisplayTitle: (title: string) => string;
  getChosung: (char: string) => string;
  globalResults: GlobalSearchResult[];
  handleGlobalSearch: () => void;
  setCurrentIndex: (i: number) => void;
  isSearching: boolean;
  sentenceRefs: RefObject<(HTMLSpanElement | null)[]>;
  displaySentences: string[]; // ✅ 본문 검색에 필요
  setShowModal: (b: boolean) => void; // ✅ 본문 검색 버튼 닫기에 필요
}

export default function ScriptureModal({
  selected,
  setSelected,
  onClose,
  search,
  setSearch,
  modalTab,
  setModalTab,
  groupedTitles,
  usedInitials,
  initialFilter,
  setInitialFilter,
  expandedBase,
  setExpandedBase,
  formatDisplayTitle,
  getChosung,
  globalResults,
  handleGlobalSearch,
  setCurrentIndex,
  isSearching,
  sentenceRefs,
  displaySentences,
  setShowModal,
  setBookmarkPending,
}: ScriptureModalProps) {
  useEffect(() => {
    if (modalTab !== 'global' && isSearching) {
      setSearch('');
    }
  }, [modalTab, setSearch, isSearching]);

  // 모달 열림 동안 배경(body) 스크롤 잠금. 백드롭 위 스크롤로 뒷페이지가 움직이는 동작 차단.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center">
      <div onClick={(e) => e.stopPropagation()} className="bg-surface-elevated rounded-t-2xl p-4 h-[80vh] overflow-y-auto overscroll-contain w-full max-w-md flex flex-col justify-between">
        <div>
          {/* 탭 메뉴 */}
          <div className="flex mb-4">
            {(['title', 'content', 'global'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setModalTab(tab)}
                className={`flex-1 py-2 ${modalTab === tab ? 'bg-accent text-on-brand' : 'bg-accent-soft text-on-brand'} ${tab === 'title' ? 'rounded-l-xl' : tab === 'global' ? 'rounded-r-xl' : ''}`}
              >
                {tab === 'title' ? '경전명' : tab === 'content' ? '본문검색' : '전체검색'}
              </button>
            ))}
          </div>

          {/* 검색창 */}
          <input
            placeholder="검색어 입력..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />

          {/* 경전명 검색 */}
          {modalTab === 'title' && (
            <div className="flex w-full">
              <div className="flex flex-col mr-4 space-y-1">
                {[...['전체'], ...Array.from(usedInitials)].map((initial) => (
                  <button
                    key={initial}
                    onClick={() => setInitialFilter(initial)}
                    className={`px-3 py-1 text-base text-start w-16 ${initialFilter === initial ? 'rounded-lg bg-accent-soft/20 text-ink font-semibold' : 'bg-surface-elevated text-accent border-accent'}`}
                  >
                    {initial}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[50vh]">
                <div>
                <button
  disabled
  className="h-8 w-full px-4 text-left bg-accent-soft/20 text-accent font-semibold rounded-lg flex items-center justify-start"
>
  <span className="truncate whitespace-nowrap overflow-hidden">
    {formatDisplayTitle(selected).replace(/\s*\d+권$/, '')}
  </span>
  <span className="ml-1 flex-shrink-0">
    {formatDisplayTitle(selected).match(/\d+권$/)?.[0] || ''}
  </span>
</button>
                </div>

                <ul className="space-y-2">
                  {Object.entries(groupedTitles)
                    .filter(([base]) => {
                      if (search) return base.includes(search);
                      if (initialFilter === '전체') return true;
                      return getChosung(base.charAt(0)) === initialFilter;
                    })
                    .map(([base, titles]) => {
                      const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
                      const isSingle = titles.length === 1;
                      const hasVolumePattern = titles.some(t => /_\d+권/.test(t));
                      return (
                        <li key={base}>
                          {isSingle || !hasVolumePattern ? (
                            <button
                              onClick={() => {
                                setSelected(sortedTitles[0]);
                                onClose();
                              }}
                              className="w-full px-4 py-2 text-left bg-surface-elevated hover:bg-accent-soft/20 rounded-lg"
                            >
                              {base}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setExpandedBase(expandedBase === base ? null : base)}
                                className="w-full flex justify-between items-center px-4 py-2 bg-surface-elevated hover:bg-accent-soft/20 rounded-lg"
                              >
                                <span>{base}</span>
                                <span>{expandedBase === base ? '⏶' : '⏷'}</span>
                              </button>
                              {expandedBase === base && (
                                <ul className="pl-6 mt-1 space-y-1">
                                  {sortedTitles.map((title) => (
                                    <li key={title}>
                                      <button
                                        onClick={() => {
                                          setSelected(title);
                                          onClose();
                                        }}
                                        className={`w-full text-left text-sm hover:underline ${title === selected ? 'text-accent font-semibold' : 'text-ink-muted'}`}
                                      >
                                        {formatDisplayTitle(title)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>
          )}

          {/* 본문 검색 */}
          {modalTab === 'content' && (
            <>
              {search.trim().length === 0 ? (
                <p className="text-center text-sm text-ink-subtle mt-4">
                  검색어를 입력하면 현재 경전에서 검색됩니다.
                </p>
              ) : (
                <ul>
                  {displaySentences
                    .map((s, i) => ({ text: s, index: i }))
                    .filter(({ text }) => text.includes(search))
                    .map(({ text, index }) => (
                      <li key={index}>
                        <button
                          onClick={() => {
                            setCurrentIndex(index);
                            setShowModal(false);
                            setTimeout(() => {
                              sentenceRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 200);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-accent-soft/20 text-sm"
                        >
                          <div className="line-clamp-3">
                            <span className="text-ink-subtle">[{index + 1}행]</span> {text}
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}

          {/* 전체 검색 */}
          {modalTab === 'global' && (
            <>
              <button
                onClick={handleGlobalSearch}
                disabled={isSearching || !search.trim()}
                className={`w-full py-2 mb-4 rounded-lg ${isSearching ? 'bg-gray-300 text-ink-muted cursor-not-allowed' : 'bg-accent-soft text-on-brand'}`}
              >
                {isSearching ? '🔍 검색 중입니다...' : '전체 검색 실행'}
              </button>

              <ul>
                {globalResults.map(({ title, index, text }, i) => (
                  <li key={`${title}-${index}-${i}`}>
                    <button
// global 검색에서 클릭할 때
onClick={() => {
  setSelected(title);
  onClose();
  setBookmarkPending({ title, index });  // ✅ 여기다 임시로 저장
}}
                      className="w-full text-left px-4 py-4 hover:bg-accent-soft/20 hover:text-on-brand text-sm"
                      disabled={isSearching}
                    >
                      <div className="line-clamp-3">
                        <span className="text-ink-subtle">[{formatDisplayTitle(title)} {index + 1}행]</span>
                        <div className="mt-1 text-ink">{text || '(본문을 불러오지 못했습니다)'}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 border border-accent text-accent rounded-lg"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
