// 옛 title 표기(예: `금강반야바라밀경_K0013_1권`) → 신규 Layer 3 path 변환.
// 옛 page (`/scripture?title=...`) 진입을 신규 `/scripture/[group]/[volume]` 으로 라우팅하는
// 모든 호출부 공용. group_key + volume_no 분리 규칙은 M1 schema 와 동일.

export function titleToReaderPath(title: string): string {
  const m = title.match(/^(.+?)_(\d+)권$/);
  if (m) {
    const grp = m[1];
    const vol = parseInt(m[2], 10);
    return `/scripture/${encodeURIComponent(grp)}/${vol}`;
  }
  return `/scripture/${encodeURIComponent(title)}/1`;
}
