import { NextResponse } from 'next/server';

// 질문 화면이 열릴 때 부르는 웜업. 예전에는 요청의 query를 OpenAI로 임베딩하고
// 벡터 검색까지 해서, 누구나 서비스의 키로 임베딩을 무한히 호출할 수 있었다.
// 서버리스 함수를 깨우는 효과만 남기고 외부 호출은 하지 않는다.
export async function POST() {
  return NextResponse.json({ success: true });
}
