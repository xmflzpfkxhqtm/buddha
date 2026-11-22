// TTS로 새로 합성할 문장이 해당 경전 본문에 실제로 있는지 확인한다.
// 아무 문장이나 합성하는 데 Google TTS 키가 쓰이지 않게 하기 위한 것이다.
// Flutter 앱의 Edge Function(tts-synthesize)과 같은 규칙이다.
//
// 웹 리더는 본문 문장에서 괄호 안만 지워 보내고, 앱은 [[찾을말|보일말]]과 * 강조도
// 지워 보낸다. 본문 원문과 표기를 지운 본문 둘 다와, 글자·숫자만 남겨 비교한다.

function stripInlineMarkers(text: string): string {
  return text
    .replace(/\[\[([^[\]]+?)\]\]/g, (_m, inner: string) => {
      const parts = inner.trim().split('|');
      const lookup = parts[0].trim();
      const display = parts.length > 1 ? parts[1].trim() : '';
      return display || lookup || inner;
    })
    .replace(/\*\*\*([^*]+?)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1');
}

function normalizeForMatch(text: string): string {
  return text.replace(/\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

export function contentContainsSentence(content: string, sentence: string): boolean {
  const needle = normalizeForMatch(sentence);
  if (!needle) return false;
  return (
    normalizeForMatch(content).includes(needle) ||
    normalizeForMatch(stripInlineMarkers(content)).includes(needle)
  );
}
