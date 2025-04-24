'use client';
import { Dispatch, RefObject, SetStateAction } from 'react';

import { useEffect } from 'react';
import Image from 'next/image';

interface GlobalSearchResult {
  title: string;
  index: number;
  text: string;
}

interface ScriptureModalProps {
  selected: string;
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
  expandedBase: string | null;
  setExpandedBase: (s: string | null) => void;
  formatDisplayTitle: (title: string) => string;
  getChosung: (char: string) => string;
  globalResults: GlobalSearchResult[];
  handleGlobalSearch: () => void;
  setCurrentIndex: (i: number) => void;
  isSearching: boolean;
  sentenceRefs: RefObject<(HTMLSpanElement | null)[]>; // ✅ 이 줄 추가

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
  sentenceRefs, // ✅ 추가
  isSearching,
}: ScriptureModalProps) {
  useEffect(() => {
    if (modalTab !== 'global' && isSearching) {
      setSearch('');
    }
  }, [modalTab]);

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-end justify-center">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl p-4 h-[80vh] overflow-y-auto w-full max-w-md flex flex-col justify-between">
        <div>
          <div className="flex mb-4">
            {(['title', 'content', 'global'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setModalTab(tab)}
                className={`flex-1 py-2 ${modalTab === tab ? 'bg-red text-white' : 'bg-red-light text-white'} ${tab === 'title' ? 'rounded-l-xl' : tab === 'global' ? 'rounded-r-xl' : ''}`}
              >
                {tab === 'title' ? '경전명' : tab === 'content' ? '본문검색' : '전체검색'}
              </button>
            ))}
          </div>

          <input
            placeholder="검색어 입력..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full mb-4 px-4 py-2 border rounded-lg"
          />

          {modalTab === 'title' && (
            <div className="flex w-full">
              <div className="flex flex-col mr-4 space-y-1">
                {[...['전체'], ...Array.from(usedInitials)].map((initial) => (
                  <button
                    key={initial}
                    onClick={() => setInitialFilter(initial)}
                    className={`px-3 py-1 text-base text-start w-16 ${initialFilter === initial ? 'bg-red-100 text-black font-semibold' : 'bg-white text-red-dark border-red'}`}
                  >
                    {initial}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[50vh]">
                <div>
                  <button
                    disabled
                    className="w-full px-4 text-left bg-red-100 text-red-dark font-semibold rounded-lg"
                  >
                    현재 『{formatDisplayTitle(selected)}』 열람 중
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
                              className="w-full px-4 py-2 text-left bg-white hover:bg-red-100 rounded-lg"
                            >
                              {base}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setExpandedBase(expandedBase === base ? null : base)}
                                className="w-full flex justify-between items-center px-4 py-2 bg-white hover:bg-red-100 rounded-lg"
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
                                        className={`w-full text-left text-sm hover:underline ${title === selected ? 'text-red font-semibold' : 'text-gray-700'}`}
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

          {modalTab === 'global' && (
            <>
              <button
                onClick={handleGlobalSearch}
                disabled={isSearching || !search.trim()}
                className={`w-full py-2 mb-4 rounded-lg ${isSearching ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-light text-white'}`}
              >
                {isSearching ? '🔍 검색 중입니다...' : '전체 검색 실행'}
              </button>
              <ul>
                {globalResults.map(({ title, index, text }, i) => (
                  <li key={`${title}-${index}-${i}`}>
                    <button
                      onClick={() => {
                        setSelected(title);
                        onClose();
                        setTimeout(() => setCurrentIndex(index), 100);
                      }}
                      className="w-full text-left px-4 py-4 hover:bg-red-100 hover:text-white text-sm"
                      disabled={isSearching}
                    >
                      <div className="line-clamp-3">
                        <span className="text-gray-500">[{formatDisplayTitle(title)} {index + 1}행]</span>
                        <div className="mt-1 text-black">{text || '(본문을 불러오지 못했습니다)'}</div>
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
          className="mt-4 w-full py-2 border border-red text-red-dark rounded-lg"
        >
          닫기
        </button>
      </div>
    </div>
  );
}