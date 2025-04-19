'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';

export default function LoginPage() {
  const router = useRouter();

  // ✅ 로그인 상태일 경우 /me로 이동
  useEffect(() => {
    const checkLogin = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push('/me');
      }
    };
    checkLogin();
  }, [router]);

  // ✅ 구글 로그인 함수
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined'
            ? window.location.origin
            : 'https://buddha-dusky.vercel.app',
      },
    });

    if (error) {
      alert('로그인 실패');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-xs bg-white rounded-2xl border text-red-dark border-red-light p-8 text-center space-y-6">
        <h1 className="text-xl font-semibold">로그인 & 회원가입</h1>
        <span> 간편하게 로그인하고 <br></br>연등에 불을 밝혀주세요</span>
        <div className="w-full mt-12">
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2 hover:bg-gray-100 transition"
        >
          <FcGoogle size={20} />
          <span className="font-medium">Google로 로그인</span>
        </button>
        </div>
      </div>
    </main>
  );
}
