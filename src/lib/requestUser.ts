// 서버 Route Handler에서 요청한 사용자를 확인한다.
// 브라우저 세션은 localStorage에 있어 쿠키로 오지 않으므로, 클라이언트가
// `Authorization: Bearer <access_token>`을 보내야 한다(`authHeaders`).
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/** 토큰이 유효하면 그 사용자, 없거나 무효면 null. */
export async function getRequestUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

/**
 * 요청의 user_id가 토큰의 사용자와 같을 때만 그 id를 돌려준다.
 * 다른 사람의 user_id로 service role 조회를 하지 못하게 막는다.
 */
export async function requireSameUser(req: Request, claimedUserId: string | null | undefined): Promise<string | null> {
  if (!claimedUserId) return null;
  const user = await getRequestUser(req);
  return user && user.id === claimedUserId ? user.id : null;
}
