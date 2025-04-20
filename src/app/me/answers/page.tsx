'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Answer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 6;

export default function AnswerPage() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

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
          .from('answers')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

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
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">🪷 내가 저장한 말씀들</h1>

      {answers.length === 0 ? (
        <p className="text-sm text-gray-500">아직 저장된 말씀이 없습니다.</p>
      ) : (
        <>
          {/* ✅ 바둑판 레이아웃 */}
          <ul className="grid grid-cols-2 gap-4 mb-6">
  {paginatedAnswers.map((item) => (
    <li
      key={item.id}
      className="p-4 h-[300px] rounded-xl shadow border bg-white flex flex-col"
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


          {/* ✅ 페이지네이션 */}
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
    </main>
  );
}
