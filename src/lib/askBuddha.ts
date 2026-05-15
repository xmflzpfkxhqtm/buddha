// 부처님 문답 — /api/ask 호출 + temp_answers row 조회 + 저장 헬퍼.
// /ask/confirm 페이지 흐름과 동일 endpoint, 모달에서 직접 사용.

import { supabase } from '@/lib/supabaseClient';

export type BuddhaAnswer = {
  id: string;
  question: string;
  answer: string;
};

export type AskOptions = {
  question: string;
  length?: 'short' | 'long';
  parentId?: string | null;
  /** 경전 인용 기반 질문이면 출처 title (예: '금강반야바라밀경_K0013_1권'). 없으면 일반 질문. */
  scriptureTitle?: string;
};

export async function askBuddha({
  question,
  length = 'short',
  parentId = null,
  scriptureTitle,
}: AskOptions): Promise<BuddhaAnswer> {
  // user_id 를 server 에 함께 보냄 — temp_answers.user_id 채워야 /me/answers 에서 fetch 가능.
  // (server 는 anon client 라 자체 auth 추출 불가)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('로그인이 필요합니다.');

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, parentId, length, userId: user.id }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `답변 요청 실패 (${res.status})`);
  }
  const data = (await res.json()) as { questionId?: string; error?: string; message?: string };
  if (!data?.questionId) {
    throw new Error(data?.message || data?.error || '서버 응답에 questionId 가 없습니다.');
  }
  // 경전 인용 기반 질문이면 출처 title 별도 update — /me/answers 탭 분리에 사용.
  // RLS update policy 가 본인 row 만 허용하므로 정상 흐름에선 통과.
  if (scriptureTitle) {
    const { error: titleErr, data: updated } = await supabase
      .from('temp_answers')
      .update({ scripture_title: scriptureTitle })
      .eq('id', data.questionId)
      .select('id, scripture_title')
      .single();
    if (titleErr || !updated) {
      console.error('[askBuddha] scripture_title update failed', {
        error: titleErr,
        questionId: data.questionId,
        scriptureTitle,
      });
    }
  }
  const { data: row, error } = await supabase
    .from('temp_answers')
    .select('id, question, answer')
    .eq('id', data.questionId)
    .single();
  if (error || !row) throw new Error('답변을 불러오지 못했습니다.');
  return row as BuddhaAnswer;
}

export async function saveAnswer(id: string): Promise<void> {
  const { error } = await supabase
    .from('temp_answers')
    .update({ is_saved: true, saved_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 인용 + 사용자 질문 → LLM 친화 prompt 형식. /ask 페이지의 buildCitedQuestion 와 동일. */
export function buildCitedQuestion(
  citation: { text: string; titleClean: string },
  userQuestion: string,
): string {
  const userPart = userQuestion.trim()
    ? `질문:\n${userQuestion.trim()}`
    : '이 구절의 의미를 자세히 알려주세요.';
  return `다음 경전 구절에 대해 여쭙습니다.\n\n[${citation.titleClean}]\n"${citation.text}"\n\n${userPart}`;
}
