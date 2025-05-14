'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ScrollHeader from '../../../../../../components/ScrollHeader';
import Image from 'next/image';
import type { User } from '@supabase/supabase-js';

export default function AccountDeletePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleDelete = async () => {
    if (!confirmed || !user?.id) return;
    setMessage('계정 삭제 중입니다...');
    console.log('Deleting userId:', user.id);  // userId가 제대로 전달되는지 확인

    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
  
      const result = await res.json();
  
      if (!res.ok) {
        setMessage(`❌ 계정 삭제 실패: ${result.message}`);
      } else {
        setMessage('✅ 계정이 삭제되었습니다.');
        await supabase.auth.signOut();
        router.push('/');
      }
    } catch {
      setMessage('❌ 서버 오류');
    }
  };
  
  if (loading) return null;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start bg-white py-4 px-6">
      <Image
        src="/bg_loading.png"
        alt="배경"
        fill
        className="absolute inset-0 object-cover opacity-40 pointer-events-none z-0"
        priority
      />
      <ScrollHeader />

      <div className="w-full max-w-sm bg-white rounded-2xl border text-red-dark border-red-light p-8 text-center mt-12 space-y-6 z-10">
        <h1 className="text-xl font-semibold">계정 삭제 요청</h1>
        <p>
          현재 로그인된 계정 (<span className="font-semibold">{user?.email}</span>)을 삭제하시겠습니까?
        </p>
        <p className="text-sm text-gray-500">
          계정 삭제 시 저장된 북마크 및 정보가 모두 삭제됩니다.
        </p>

        <label className="flex items-center justify-center gap-2">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="text-sm">위 내용을 이해했으며 삭제에 동의합니다.</span>
        </label>

        <button
          onClick={handleDelete}
          disabled={!confirmed}
          className={`w-full py-2 rounded-lg font-semibold text-white ${
            confirmed ? 'bg-red-light hover:bg-red' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          계정 삭제하기
        </button>

        {message && (
          <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{message}</p>
        )}
      </div>
    </main>
  );
}
