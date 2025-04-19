'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Answer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function AnswerPage() {
  const [answers, setAnswers] = useState<Answer[]>([]);

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

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold text-red-dark mb-4">🪷 내가 저장한 말씀들</h1>
      {answers.length === 0 ? (
        <p className="text-sm text-gray-500">아직 저장된 말씀이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {answers.map((item) => (
            <div key={item.id} className="p-4 rounded-xl shadow border bg-white">
              <p className="text-xs text-gray-500 mb-2">🕰 {new Date(item.created_at).toLocaleString()}</p>
              <p className="font-bold text-red mb-1">🪷 부처님 말씀</p>
              <p className="text-sm text-black whitespace-pre-wrap mb-2">{item.answer}</p>
              <p className="font-bold text-red mb-1">📜 나의 질문</p>
              <p className="text-sm text-black">「{item.question}」</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
