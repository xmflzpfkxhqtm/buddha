'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from('feedback').insert({
      user_id: user?.id,
      message,
    });

    setSubmitted(true);
    setMessage('');
  };

  return (
    <main className="min-h-screen flex flex-col items-center max-w-[430px] mx-auto bg-[#F5F1E6] px-4 py-10">
      <h1 className="text-xl text-left w-full font-bold text-red mb-4">💬 피드백 보내기</h1>
      {submitted ? (
        <p className="text-green-600">소중한 피드백 감사합니다!</p>
      ) : (
        <>
          <textarea
            className="w-full p-3 rounded-md border border-gray-300 bg-white text-sm"
            rows={5}
            placeholder="불편한 점이나 개선 아이디어가 있다면 자유롭게 남겨주세요."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            onClick={handleSubmit}
            className="mt-4 px-4 py-2 bg-red-light text-white text-base rounded hover:bg-red"
          >
            제출하기
          </button>
        </>
      )}
    </main>
  );
}
