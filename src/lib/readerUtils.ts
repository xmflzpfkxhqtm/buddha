export const getChosung = (char: string): string => {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return char;
  const baseConsonants = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const labels: Record<string, string> = {'ㄱ':'가','ㄴ':'나','ㄷ':'다','ㄹ':'라','ㅁ':'마','ㅂ':'바','ㅅ':'사','ㅇ':'아','ㅈ':'자','ㅊ':'차','ㅋ':'카','ㅌ':'타','ㅍ':'파','ㅎ':'하'};
  const cho = baseConsonants[Math.floor(code / 588)];
  return labels[cho] || char;
};

export const resolveActualTitle = (title: string, list: string[]): string | null => {
  if (list.includes(title)) return title;
  if (title.endsWith('_GPT4.1번역')) {
    const fallback = title.replace('_GPT4.1번역', '_1권_GPT4.1번역');
    if (list.includes(fallback)) return fallback;
  }
  const candidate = list.find((t) => t.startsWith(title));
  return candidate || null;
};

export function getScriptureGroupBase(title: string): string {
  const m = title.match(/_K\d{4}(?:_|$)/u);
  if (m && m.index !== undefined) {
    return title.slice(0, m.index + 6);
  }
  return title.split('_')[0];
}

export const READ_STATE_PREFIX = 'scripture-read:';
export const LAST_VOLUME_PREFIX = 'scripture-last:';
export const LAST_GLOBAL_KEY = 'scripture-last-global';

export function setReadStateIfHigher(groupKey: string, volumeNo: number, next: 'reading' | 'read') {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    const key = `${READ_STATE_PREFIX}${groupKey}:${volumeNo}`;
    const prev = window.localStorage.getItem(key);
    if (prev === 'read') return;
    window.localStorage.setItem(key, next);
  } catch {
    /* localStorage 미가용/쿼터 초과 무시 */
  }
}

export function setLastVolume(groupKey: string, volumeNo: number) {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    window.localStorage.setItem(`${LAST_VOLUME_PREFIX}${groupKey}`, String(volumeNo));
  } catch {
    /* noop */
  }
}

export function setLastGlobal(groupKey: string, volumeNo: number) {
  if (typeof window === 'undefined') return;
  if (!groupKey || !Number.isFinite(volumeNo)) return;
  try {
    window.localStorage.setItem(
      LAST_GLOBAL_KEY,
      JSON.stringify({ groupKey, volumeNo, viewedAt: Date.now() }),
    );
  } catch {
    /* noop */
  }
}
