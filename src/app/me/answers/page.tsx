'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAskStore } from '@/stores/askStore';
import { useRouter } from 'next/navigation'; // ✅ 상단 추가

interface TempAnswer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 6;

export default function AnswerPage() {
    const [answers, setAnswers] = useState<TempAnswer[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedItem, setSelectedItem] = useState<TempAnswer | null>(null);
    const { setParentId } = useAskStore();
    const router = useRouter(); // ✅ 여기 추가
    const totalPages = Math.ceil(answers.length / ITEMS_PER_PAGE);
  const paginatedAnswers = answers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (user) {
        const { data: answerData } = await supabase
          .from('temp_answers')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_saved', true) // ✅ 저장된 질문만
          .order('saved_at', { ascending: false }); // ✅ 저장된 시점 기준 정렬

        if (answerData) {
          setAnswers(answerData);
        }
      }
    });
  }, []);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10 relative">
      <h1 className="text-xl font-bold text-red-dark mb-4">🪷 내가 저장한 말씀들</h1>

      {answers.length === 0 ? (
        <p className="text-sm text-gray-500">아직 저장된 말씀이 없습니다.</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 mb-6">
            {paginatedAnswers.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="p-4 h-[300px] rounded-xl shadow border bg-white flex flex-col cursor-pointer"
              >
                <p className="text-[10px] text-right text-gray-400 mb-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-red font-semibold mb-1 line-clamp-1">📜 나의 질문</p>
                <p className="text-[13px] text-gray-800 mb-2 line-clamp-2">「{item.question}」</p>
                <p className="text-xs text-red font-semibold mb-1 line-clamp-1">🪷 부처님 말씀</p>
                <p className="text-[13px] text-gray-900 line-clamp-8">{item.answer}</p>
              </li>
            ))}
          </ul>

          <div className="flex justify-center items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="text-sm px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ◀
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`text-sm px-3 py-1 rounded border ${
                  page === currentPage ? 'bg-red-dark text-white' : 'bg-white text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="text-sm px-2 py-1 rounded border bg-white disabled:text-gray-300"
            >
              ▶
            </button>
          </div>
        </>
      )}

{selectedItem && (
  <div
    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4"
    onClick={() => setSelectedItem(null)}
  >
    <div
      className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6 relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setSelectedItem(null)}
        className="absolute top-3 right-4 text-gray-400 hover:text-black text-xl"
      >
        ×
      </button>

      <p className="text-xs text-gray-500 text-right mb-2">
        {new Date(selectedItem.created_at).toLocaleDateString()}
      </p>

      <p className="text-sm font-semibold text-red mb-1">📜 나의 질문</p>
      <p className="text-[13px] text-gray-800 mb-4 whitespace-pre-line">
        「{selectedItem.question}」
      </p>

      <p className="text-sm font-semibold text-red mb-1">🪷 부처님 말씀</p>
      <p className="text-[13px] text-gray-900 whitespace-pre-line">
        {selectedItem.answer}
      </p>

      <button
        onClick={() => {
          setParentId(selectedItem.id);
          setSelectedItem(null);
          router.push('/ask');
        }}
        className="w-full mt-4 py-3 border border-red text-red-dark font-bold rounded-4xl hover:bg-red hover:text-white transition"
      >
        더 여쭙기
      </button>
    </div>
  </div>
)}

    </main>
  );
}
