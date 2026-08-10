export function formatDisplayTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle.replace(/_GPT\d+(\.\d+)?번역/, '').replace(/_/g, ' ');
}

/** K코드(예: _K0001) 및 언더스코어를 제거한 경전 제목 */
export function formatScriptureTitle(title: string): string {
  if (!title) return '';
  return title.replace(/_K\d{4}/, '').replace(/_/g, ' ');
}
