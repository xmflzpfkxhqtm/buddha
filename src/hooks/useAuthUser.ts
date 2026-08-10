'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * 현재 로그인 사용자 ID를 반환.
 * undefined = 아직 로딩 중, null = 비로그인, string = 로그인됨.
 */
export function useAuthUser(): string | null | undefined {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);
  return userId;
}
