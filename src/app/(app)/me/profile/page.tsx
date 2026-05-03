'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notification, setNotification] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const session = await supabase.auth.getSession();

      if (!authData.user) return;
      setUser(authData.user);

      // users 테이블에서 정보 불러오기
      const { data: profile } = await supabase
        .from('users')
        .select('username, birth_date, notification')
        .eq('id', authData.user.id)
        .single();

      // ✅ username이 없으면 auth metadata fallback
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
    setSaveMessage('');
    setIsSaving(true);

    // ✅ users 테이블 업데이트 (auth는 건드리지 않음)
    const { error: tableError } = await supabase.from('users').upsert({
      id: user.id,
      username: username.trim(),
      birth_date: birthDate,
      notification,
      email: user.email,
    });

    if (tableError) {
      setSaveMessage('❌ 사용자 정보 저장 중 오류가 발생했습니다.');
      setIsSaving(false);
      return;
    }

    setSaveMessage('✅ 저장되었습니다.');
    setTimeout(() => {
      router.push('/me');
    }, 500);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 가입`;
  };

  return (
    <main className="min-h-screen max-w-[430px] mx-auto bg-surface px-6 py-10 flex flex-col gap-6">
      <div className="bg-surface-elevated shadow border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">👤 프로필 관리</h2>

        {user && (
          <div className="mb-6 text-sm text-ink-muted space-y-1">
            <p>🔑 로그인 방식: <strong>{provider}</strong></p>
            <p>📧 로그인 이메일: <strong>{user.email}</strong></p>
            <p>🗓️ 가입일: <strong>{formatDate(user.created_at)}</strong></p>
          </div>
        )}

        {formError && (
          <p className="text-sm text-red-600 font-medium mb-4">{formError}</p>
        )}

        {/* 이름 (username) */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-ink-muted mb-1">이름</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 text-sm"
            placeholder="이름을 입력하세요"
          />
        </div>

        {/* 생년월일 */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-ink-muted mb-1">생년월일</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* 알림 설정 */}
        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="notification"
            checked={notification}
            onChange={(e) => setNotification(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="notification" className="text-sm text-ink-muted">
            공지사항 및 알림 수신에 동의합니다
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full mt-2 bg-accent-soft hover:bg-accent text-on-brand py-2 px-4 rounded-lg text-sm font-semibold"
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>

        {saveMessage && (
          <p className="text-sm text-center mt-3 text-ink-muted">{saveMessage}</p>
        )}

<p className="text-xs text-center text-ink-subtle mt-4">
  입력하신 개인정보는 서비스 이용을 위한 본인 식별 및 통계 분석 목적으로만 사용되며,
  동의 없이 외부에 제공되지 않습니다.
</p>
<p className="text-xs text-center text-ink-subtle">
  자세한 내용은 <a href="/privacy" className="underline hover:text-accent">개인정보 처리방침</a>을 확인해주세요.
</p>
<p className="text-xs text-center text-ink-subtle mt-2">
  <button
    onClick={() => router.push('/me/profile/account-delete')}
    className="underline hover:text-accent"
  >
    계정 삭제 요청하기
  </button>
</p>

      </div>
  

    </main>
  );
}
