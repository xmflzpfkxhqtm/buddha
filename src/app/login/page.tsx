'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import { SiKakaotalk, SiApple } from 'react-icons/si';
import Image from 'next/image';
import ScrollHeader from '../../../components/ScrollHeader';
import { Browser } from '@capacitor/browser';

declare global {
  interface Window {
    Capacitor?: {
      getPlatform: () => 'ios' | 'android' | 'web';
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  // ✅ 로그인 상태일 경우 /me로 이동
  useEffect(() => {
    const checkLogin = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push('/me');
      }
    };
    checkLogin();

    // ✅ 플랫폼 확인
    if (typeof window !== 'undefined' && window.Capacitor?.getPlatform) {
      setPlatform(window.Capacitor.getPlatform());
    }
  }, [router]);

  // ✅ 환경별 redirectTo 결정
  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  const redirectTo = isNativeApp()
    ? 'yeondeung://auth/callback'
    : isLocal
      ? 'http://localhost:3000/auth/deeplink'
      : 'https://buddha-dusky.vercel.app/auth/deeplink';

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        // @ts-expect-error - Supabase OAuth options type doesn't include flowType
        flowType: 'pkce',
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) alert('구글 로그인 실패');
    if (data?.url) await Browser.open({ url: data.url });
  };

  const handleKakaoLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo },
    });
    if (error) alert('카카오 로그인 실패');
    if (data?.url) await Browser.open({ url: data.url });
  };

  const handleAppleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectTo, // ✅ 이거 반드시 필요!
        skipBrowserRedirect: true,
        // @ts-expect-error - Supabase OAuth options type doesn't include flowType
        flowType: 'pkce',
      },
    });
    if (error) alert('Apple 로그인 실패');
    if (data?.url) await Browser.open({ url: data.url });
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

          {/* ✅ iOS 네이티브 앱에서만 Apple 로그인 표시 */}
          {platform === 'ios' && (
            <button
              onClick={handleAppleLogin}
              className="w-full flex items-center justify-center gap-2 border bg-black border-black rounded-lg py-2 hover:bg-gray-800 transition"
            >
              <SiApple size={20} color="#fff" />
              <span className="font-medium text-white">Apple로 로그인</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ✅ Native 앱 판별 함수
function isNativeApp() {
  if (typeof window === 'undefined') return false;
  // @ts-expect-error Capacitor global only in native build
  return !!window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web';
}
