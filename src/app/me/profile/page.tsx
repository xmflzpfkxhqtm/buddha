'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [notification, setNotification] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      const session = await supabase.auth.getSession();

      if (data.user) {
        setUser(data.user);
        setName(data.user.user_metadata?.full_name || '');
        setBirthDate(data.user.user_metadata?.birth_date || '');
        setNotification(data.user.user_metadata?.notification ?? true);
      }

      const loginProvider = session.data?.session?.provider_token
        ? session.data.session.user?.app_metadata?.provider
        : data.user?.app_metadata?.provider;

      setProvider(loginProvider || 'email');
    };

    fetchUser();
  }, []);

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
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

    // ✅ 1. auth.user_metadata 업데이트
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim(),
        birth_date: birthDate, 
        notification,
        email: user.email,
      },
    });

    if (authError) {
      setSaveMessage('❌ auth 업데이트 중 오류가 발생했습니다.');
      setIsSaving(false);
      return;
    }

    // ✅ 2. users 테이블 업데이트 (upsert)
    const { error: tableError } = await supabase.from('users').upsert({
      id: user.id,
      full_name: name.trim(),
      birth_date: birthDate, 
      notification,
      email: user.email,
    });

    if (tableError) {
      setSaveMessage('❌ 사용자 테이블 업데이트 중 오류가 발생했습니다.');
      setIsSaving(false);
      return;
    }

    // ✅ 성공 처리
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
    <main className="min-h-screen max-w-[430px] mx-auto bg-[#F5F1E6] px-6 py-10 flex flex-col gap-6">
      <div className="bg-white shadow border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">👤 프로필 관리</h2>

        {user && (
          <div className="mb-6 text-sm text-gray-600 space-y-1">
            <p>🔑 로그인 방식: <strong>{provider}</strong></p>
            <p>📧 로그인 이메일: <strong>{user.email}</strong></p>
            <p>🗓️ 가입일: <strong>{formatDate(user.created_at)}</strong></p>
          </div>
        )}

        {formError && (
          <p className="text-sm text-red-600 font-medium mb-4">{formError}</p>
        )}

        {/* 이름 */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="이름을 입력하세요"
          />
        </div>

        {/* 생년월일 */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">생년월일</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
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
          <label htmlFor="notification" className="text-sm text-gray-700">
            공지사항 및 알림 수신에 동의합니다
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full mt-2 bg-red-dark hover:bg-red text-white py-2 px-4 rounded-lg text-sm font-semibold"
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>

        {saveMessage && (
          <p className="text-sm text-center mt-3 text-gray-700">{saveMessage}</p>
        )}

        <p className="text-xs text-center text-gray-500 mt-4">
          입력하신 개인정보는 서비스 이용을 위한 본인 식별 및 통계 분석 목적으로만 사용되며,
          동의 없이 외부에 제공되지 않습니다.
        </p>
        <p className="text-xs text-center text-gray-500">
          자세한 내용은 <a href="/privacy" className="underline hover:text-red-dark">개인정보 처리방침</a>을 확인해주세요.
        </p>
      </div>
    </main>
  );
}
