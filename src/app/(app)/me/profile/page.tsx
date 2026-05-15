'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import BirthDateWheel from './BirthDateWheel';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notification, setNotification] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const session = await supabase.auth.getSession();

      if (!authData.user) return;
      setUser(authData.user);

      const { data: profile } = await supabase
        .from('users')
        .select('username, birth_date, notification')
        .eq('id', authData.user.id)
        .single();

      setUsername(profile?.username || authData.user.user_metadata?.full_name || '');
      setBirthDate(profile?.birth_date || '');
      setNotification(profile?.notification ?? true);

      const loginProvider = session.data?.session?.provider_token
        ? session.data.session.user?.app_metadata?.provider
        : authData.user?.app_metadata?.provider;

      setProvider(loginProvider || 'email');
    };

    fetchUser();
  }, []);

  // 토스트 자동 닫힘
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (!user) return;

    if (!username.trim()) {
      setFormError('이름을 입력해주세요.');
      return;
    }
    if (!birthDate) {
      setFormError('생년월일을 입력해주세요.');
      return;
    }

    setFormError('');
    setIsSaving(true);

    const { error: tableError } = await supabase.from('users').upsert({
      id: user.id,
      username: username.trim(),
      birth_date: birthDate,
      notification,
      email: user.email,
    });

    setIsSaving(false);

    if (tableError) {
      setToast('저장 중 오류가 발생했습니다.');
      return;
    }

    setToast('저장되었습니다.');
    setTimeout(() => router.push('/me'), 600);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-surface-elevated px-6 py-8">
      {/* 계정 정보 — 읽기 전용 */}
      {user && (
        <section className="pb-6 border-b border-line">
          <dl className="text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-muted">로그인 방식</dt>
              <dd className="text-ink font-medium capitalize">{provider}</dd>
            </div>
            <div className="flex items-center justify-between py-2 gap-3">
              <dt className="text-ink-muted shrink-0">이메일</dt>
              <dd className="text-ink font-medium truncate">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-ink-muted">가입일</dt>
              <dd className="text-ink font-medium">{formatDate(user.created_at)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* 편집 폼 */}
      <section className="pt-6 space-y-5">
        {formError && (
          <p className="text-sm text-accent font-medium">{formError}</p>
        )}

        <div>
          <label htmlFor="username" className="block text-sm font-semibold text-ink-muted mb-2">
            이름
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full h-12 px-4 rounded-lg border border-line bg-surface-elevated text-base text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {/* 생년월일 — iOS 스타일 휠 picker (연/월/일 각각 세로 스크롤) */}
        <div>
          <span id="birth-date-label" className="block text-sm font-semibold text-ink-muted mb-2">
            생년월일
          </span>
          <div role="group" aria-labelledby="birth-date-label">
            <BirthDateWheel value={birthDate} onChange={setBirthDate} />
          </div>
        </div>

        <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={notification}
            onChange={(e) => setNotification(e.target.checked)}
            className="w-5 h-5 accent-accent rounded"
          />
          <span className="text-sm text-ink">공지사항 및 알림 수신에 동의합니다</span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-12 rounded-lg bg-accent text-on-brand text-base font-semibold hover:bg-accent-soft active:bg-accent-soft transition-colors disabled:bg-line-strong disabled:cursor-not-allowed"
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>
      </section>

      {/* 안내 문구 */}
      <p className="text-xs text-center text-ink-subtle mt-8 leading-relaxed">
        입력하신 개인정보는 서비스 이용을 위한 본인 식별 및 통계 분석 목적으로만 사용되며,
        동의 없이 외부에 제공되지 않습니다.
        <br />
        자세한 내용은{' '}
        <a href="/privacy" className="underline hover:text-accent">
          개인정보 처리방침
        </a>
        을 확인해주세요.
      </p>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => router.push('/me/profile/account-delete')}
          className="text-xs text-ink-subtle underline hover:text-accent"
        >
          계정 삭제 요청하기
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2 rounded-full bg-ink text-surface-elevated text-sm shadow-lg animate-fade-opacity"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
