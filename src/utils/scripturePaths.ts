import path from 'path';

/**
 * `data/scripture/` 기준 상대 경로(또는 임베딩 시 전달하는 동일 형식)에서
 * DB/API에서 쓰는 canonical `title` / RAG `source` 키를 만든다.
 * 디렉터리 구분자는 `_`로 합쳐서 서로 다른 폴더에 같은 파일명이 있어도 충돌하지 않게 한다.
 *
 * 예: `금강반야바라밀경_K0014/1권.md` → `금강반야바라밀경_K0014_1권`
 * 예: `경율이상_1권.md`(평면) → `경율이상_1권`
 */
export function scriptureTitleFromRelativePath(relativePath: string): string {
  const posix = relativePath.replace(/\\/g, '/');
  const withoutExt = posix.replace(/\.(md|txt)$/i, '');
  return withoutExt.split('/').filter(Boolean).join('_');
}

/** `data/scripture` 루트와 파일 절대경로로부터 저장소에 쓸 상대 경로(posix) */
export function relativePathUnderScriptureRoot(scriptureRootAbs: string, fileAbs: string): string {
  return path.relative(scriptureRootAbs, fileAbs).replace(/\\/g, '/');
}
