// 브라우저에서 서버 Route Handler를 부를 때 로그인 토큰을 붙인다.
// 서버는 `getRequestUser`로 이 토큰을 확인한다.
import { supabase } from '@/lib/supabaseClient';

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
