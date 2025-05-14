// ❌ 더 이상 사용되지 않음: 북마크는 클라이언트에서 직접 저장
// 이 API 라우트는 deprecated 처리됨

export async function POST() {
    return new Response('This route is deprecated. Use client-side Supabase directly.', {
      status: 410,
    });
  }
  