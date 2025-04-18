'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface Answer {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function MePage() {
    type MyUser = User & {
        user_metadata?: {
          full_name?: string;
          [key: string]: unknown; // ✅ Lint 통과!
        };
      };
          const [user, setUser] = useState<MyUser | null>(null);
      const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const currentUser = data.user;
      console.log('✅ 현재 로그인 유저 ID:', currentUser?.id); // 👈 여기에 추가!
      setUser(currentUser);
      if (currentUser) fetchAnswers(currentUser.id);
    });
  }, []);
  

  const fetchAnswers = async (userId: string) => {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('불러오기 실패:', error);
    } else {
      setAnswers(data as Answer[]);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <main className="relative min-h-screen w-full max-w-[430px] flex flex-col justify-start items-center mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl font-bold mb-4">내가 저장한 말씀들</h1>
      <p className="text-sm text-gray-600 mb-6 text-center">
        당신의 마음에 남은 질문과 부처님의 답변입니다.
      </p>

      {user && (
        <div className="w-full flex flex-col items-center mb-6">
          <p className="text-sm text-gray-700 font-semibold">{user.user_metadata?.full_name}</p>
          <p className="text-xs text-gray-500 mb-2">{user.email}</p>
          <button
            onClick={handleLogout}
            className="text-xs underline text-red-dark hover:text-red"
          >
            로그아웃
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">불러오는 중...</p>
      ) : answers.length === 0 ? (
        <div className="text-center text-gray-500">
          아직 저장된 말씀이 없습니다.
          <br />
          <button
            onClick={() => location.href = '/ask'}
            className="mt-4 px-4 py-2 bg-red-light text-white rounded-xl text-sm"
          >
            질문하러 가기
          </button>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {answers.map((item) => (
            <div key={item.id} className="p-4 rounded-xl shadow-md border border-red bg-white">
              <div className="mb-2">
                <p className="text-xs text-gray-500">🕰 {new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="mb-3">
                <p className="font-bold text-red mb-1">🪷 부처님 말씀</p>
                <p className="whitespace-pre-wrap text-sm text-black">{item.answer}</p>
              </div>
              <div>
                <p className="font-bold text-red mb-1">📜 나의 질문</p>
                <p className="text-sm text-black">「{item.question}」</p>
              </div>
            </div>
          ))}
        </div>
      )}

      
    </main>
  );
}
