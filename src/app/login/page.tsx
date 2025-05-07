'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import { SiKakaotalk, SiApple } from 'react-icons/si';
import Image from 'next/image';
import ScrollHeader from '../../../components/ScrollHeader';
import { Browser } from '@capacitor/browser';

/* ---------- 플랫폼 헬퍼 & 로깅 ---------- */
const IS_NATIVE =
  typeof window !== 'undefined' &&
  window.Capacitor?.getPlatform?.() !== 'web';

function log(tag: string, payload?: string | Record<string, unknown>) {
  console.log(`[LOGIN][${tag}]`, payload ?? '');
}

/* ---------- 컴포넌트 ---------- */
export default function LoginPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  /* --- 로그인 세션 확인 & 플랫폼 파악 --- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        log('AUTO_LOGIN', 'already signed in');
        return router.push('/me');
      }
    })();

    if (IS_NATIVE) setPlatform(window.Capacitor!.getPlatform());
  }, [router]);

  /* --- redirectTo (모든 환경 HTTPS 딥링크 통일) --- */
  const isLocal =
    typeof window !== 'undefined' && window.location.hostname === 'localhost';

  const redirectTo = IS_NATIVE
    ? 'yeondeung://auth/callback'
    : isLocal
      ? 'http://localhost:3000/auth/deeplink'
      : 'https://buddha-dusky.vercel.app/auth/deeplink';

  log('INIT', { IS_NATIVE, platform, redirectTo });

  /* ---------- 공통 OAuth 헬퍼 ---------- */
  async function oauthLogin(
    provider: 'google' | 'kakao' | 'apple',
    opts: {
      flowType?: 'pkce';
      queryParams?: Record<string, string>;
    } = {}
  ) {
    log(provider.toUpperCase(), 'start');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: IS_NATIVE, // 네이티브만 Custom Tab 사용
        ...opts,
      },
    });

    log(provider.toUpperCase(), { url: data?.url, error });

    if (error) return alert(`${provider} 로그인 실패`);

    if (data?.url) {
      if (IS_NATIVE) {
        log('BROWSER_OPEN', data.url);
        await Browser.open({ url: data.url });
      } else {
        log('WEB_REDIRECT', data.url);
        window.location.href = data.url;
      }
    }
  }

  /* ---------- 개별 핸들러 ---------- */
  const handleGoogleLogin = () =>
    oauthLogin('google', {
      flowType: 'pkce',
      queryParams: { prompt: 'select_account' },
    });

  const handleKakaoLogin = () => oauthLogin('kakao');

  const handleAppleLogin = () =>
    oauthLogin('apple', { flowType: 'pkce' });

  /* ---------- UI ---------- */
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
          {/* 구글 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 border bg-white border-gray-300 rounded-lg py-2 hover:bg-gray-100 transition"
          >
            <FcGoogle size={20} />
            <span className="font-medium">Google로 로그인</span>
          </button>

          {/* 카카오 */}
          <button
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-2 border bg-yellow-400 border-yellow-300 rounded-lg py-2 hover:bg-yellow-300 transition"
          >
            <SiKakaotalk size={20} color="#381E1F" />
            <span className="font-medium text-black">카카오톡으로 로그인</span>
          </button>

          {/* Apple – iOSㆍAndroid 네이티브 모두 표시 */}
          {IS_NATIVE && (
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
