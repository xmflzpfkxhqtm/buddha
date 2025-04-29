'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import { SiKakaotalk } from 'react-icons/si';
import Image from 'next/image';
import ScrollHeader from '../../../components/ScrollHeader';
import { Browser } from '@capacitor/browser';

// ✅ Capacitor 앱 환경 감지 함수
const isNative = () => {
  if (typeof window === 'undefined') return false;

  // @ts-expect-error
  return !!window.Capacitor;
};

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
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined'
            ? window.location.origin + '/auth/callback'
            : 'https://buddha-dusky.vercel.app/auth/callback',
      },
    });

    if (error) {
      alert('로그인 실패');
      return;
    }

    // 앱 환경이면 Browser로 열기
    if (isNative() && data?.url) {
      await Browser.open({ url: data.url });
    }
  };

  // ✅ 카카오 로그인 함수
  const handleKakaoLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo:
          typeof window !== 'undefined'
            ? window.location.origin + '/auth/callback'
            : 'https://buddha-dusky.vercel.app/auth/callback',
      },
    });

    if (error) {
      alert('카카오 로그인 실패');
      return;
    }

    // 앱 환경이면 Browser로 열기
    if (isNative() && data?.url) {
      await Browser.open({ url: data.url });
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start bg-red py-4 px-6">
      <Image
        src="/bg_loading.png"
        alt="로딩 배경"
        fill
        className="absolute inset-0 object-cover opacity-40 mix-blend-luminosity pointer-events-none z-0"
        priority
      />
      <ScrollHeader />

      <div className="w-full max-w-xs bg-white rounded-2xl border text-red-dark border-red-light p-8 text-center mt-12 space-y-6 z-10">
        <h1 className="text-xl font-semibold">로그인 및 회원가입</h1>
        <span>
          간편하게 로그인하고 <br />
          연등에 불을 밝혀주세요
        </span>

        <div className="w-full mt-12 space-y-4">
          {/* 구글 로그인 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 border bg-white border-gray-300 rounded-lg py-2 hover:bg-gray-100 transition"
          >
            <FcGoogle size={20} />
            <span className="font-medium">Google로 로그인</span>
          </button>

          {/* 카카오 로그인 */}
          <button
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-2 border bg-yellow-400 border-yellow-300 rounded-lg py-2 hover:bg-yellow-300 transition"
          >
            <SiKakaotalk size={20} color="#381E1F" />
            <span className="font-medium text-black">카카오톡으로 로그인</span>
          </button>
        </div>
      </div>
    </main>
  );
}
