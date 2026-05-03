# Claude Code 컨텍스트 — 연등 (buddha)

이 문서는 Claude Code 등 AI 코딩 도구가 이 저장소를 리팩토링하거나 기능을 추가할 때 빠르게 맥락을 잡도록 정리한 참고 자료입니다.

## 프로젝트 한 줄 요약

- **Next.js 15** 기반 웹 앱 + **Capacitor**로 iOS/Android 네이티브 래핑.
- **Supabase**(Auth + DB + 벡터 검색)와 여러 LLM/임베딩 API를 사용하는 **RAG 질의·답변** 및 **마크다운 경전 읽기·TTS** 등을 제공하는 불교 앱(브랜드: 연등 / Yeondeung).

## 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router), React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4 (`src/app/globals.css`, `@import "tailwindcss"`) |
| 상태 | Zustand (`src/stores/`) |
| 백엔드 연동 | Supabase JS 클라이언트 (`src/lib/supabaseClient.ts`) |
| 네이티브 | Capacitor 7 (`android/`, `ios/`, `capacitor.config.ts`) |
| 기타 | `next-themes`, Framer Motion, 각종 `@capacitor/*` 플러그인 |

경로 별칭: `@/*` → `./src/*` (`tsconfig.json`).

## 디렉터리 구조 (요약)

```
├── src/app/
│   ├── (site)/          # 마케팅 랜딩 등 (예: 홈 `/`)
│   └── (app)/           # 실제 앱 UX (dashboard, ask, scripture, answer, me, …)
│       └── api/         # Route Handlers (임베딩, 질문, 검색, 경전, glossary 등)
├── components/          # 공용 UI (루트 components; 일부 페이지는 여기에서 import)
├── src/stores/          # Zustand 스토어
├── src/lib/             # 클라이언트·유틸·Supabase 래핑 등
├── src/utils/           # 배치 스크립트 유틸, 청킹, CSV 등
├── data/                # 경전 원문 등 (번들/런타임 접근 패턴 확인 필요 시 각 API 참고)
├── dictionary/          # glossary CSV 등
├── public/              # 정적 자산, 폰트, 이미지
├── middleware.ts        # 앱/WebView 구분 헤더·UA 등 (직접 리다이렉트 로직은 대부분 주석 처리됨)
└── android/, ios/       # Capacitor 네이티브 프로젝트
```

## 라우팅 패턴

- **`(site)`**: 공개 마케팅 페이지. `src/app/(site)/layout.tsx`에서 `globals.css` 등 로드.
- **`(app)`**: 본 서비스. `src/app/(app)/layout.tsx`에서 내비·푸시·Capacitor 관련 셸을 감쌈.
- **API**: `src/app/(app)/api/*/route.ts` 형태의 Route Handler. 서버 전용 코드·환경변수 사용.

새 페이지를 추가할 때는 어느 그룹에 속하는지(사이트 vs 앱)를 먼저 결정하면 레이아웃·메타데이터 일관성이 유지됩니다.

## 데이터 및 콘텐츠

- 경전 원문은 **`data/scripture/<경전별 폴더>/*.md`** 처럼 중첩 폴더에 둘 수 있다. DB/API의 `title` 키는 상대경로에서 슬래시를 `_`로 합친 값이다 (예: `금강/1권.md` → `금강_1권`). 평면 배치 `금강_1권.md`와 동일 키가 되도록 설계되어 기존 파일명과 호환된다.
- `data/` 루트의 **평면** `.md`/`.txt`는 이전과 같이 지원한다. `scripts/migrate-scriptures.mjs`는 루트는 비재귀, `data/scripture/`만 재귀 스캔한다. `backup`, `.git` 디렉터리는 건너뛴다.
- 경전 본문·목록은 Supabase `scriptures` 테이블과 API (`/api/scripture`, `/api/scripture/list`)를 통해 제공한다. 로컬 파일 변경 후에는 `node scripts/migrate-scriptures.mjs`로 upsert 한다.
- 용어 팝업 등은 `dictionary/` CSV와 `/api/glossary`를 참고.
- RAG/임베딩 파이프라인: `src/utils/chunking.ts`, `src/app/(app)/api/embed/route.ts`, `src/app/(app)/api/search/route.ts`, `src/app/(app)/api/ask/route.ts` 등이 연결됨.

## 환경 변수

- 로컬은 보통 **`.env.local`** (gitignore). 키 이름은 코드·`src/lib/`·각 `route.ts`에서 참조됨.
- 리팩토링 시 새 비밀키가 필요하면 **예시만** 문서화하고 실제 값은 커밋하지 않습니다.

## 개발 명령

```bash
npm run dev      # next dev
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npx tsc --noEmit # 타입 검사 (스크립트에 없음 — 수동 실행)
```

유틸 스크립트는 `npx tsx src/utils/...` 형태로 실행하는 파일들이 있습니다.

## 리팩토링 시 권장 사항

1. **범위 최소화**: 요청된 영역만 수정하고, 동작 동일성을 우선합니다.
2. **클라이언트 경계**: `'use client'`는 필요한 컴포넌트에만 유지합니다. 레이아웃을 클라이언트로 올리면 SSR/스타일 타이밍 이슈가 생길 수 있습니다.
3. **fetch / JSON**: API 응답이 항상 순수 JSON이라 가정하지 말고, 필요 시 `response.text()` + 안전 파싱 패턴을 고려합니다.
4. **Capacitor**: `Capacitor.isNativePlatform()` 분기·딥링크·상태바 등은 네이티브에서만 의미 있는 경우가 많습니다.
5. **대용량 삭제/임베딩**: `/api/embed` 등은 타임아웃·레이트 리밋을 고려한 배치 처리가 들어 있을 수 있으니 동작을 읽고 변경합니다.

## 알려진 운영 이슈 (개발 환경)

- **여러 `next dev` 인스턴스** 또는 **포트 불일치** 시 CSS/정적 청크가 꼬여 스타일이 깨지거나 API 응답이 HTML로 섞일 수 있습니다. 가능하면 **단일 dev 서버**와 고정 포트를 사용합니다.
- **`.next` 캐시 손상** 시 `Cannot find module './xxxx.js'` 류 오류가 나며 페이지가 비어 보일 수 있습니다. 그 경우 `.next` 삭제 후 dev 재시작을 고려합니다 (권한 문제 시 해당 디렉터리 상태 확인).

## 테스트·검증 체크리스트 (변경 후)

- `npm run lint`, `npx tsc --noEmit`
- 핵심 사용자 플로우: 홈 또는 `/dashboard` → 질문 `/ask` → 확인 `/ask/confirm` → 답변 `/answer?questionId=…`
- 네이티브 전용 기능을 건드린 경우: 해당 플러그인 문서와 실제 디바이스/WebView 헤더(`middleware.ts`의 `x-yeondeung-app`) 동작을 확인합니다.

---

이 파일은 코드와 함께 업데이트하는 것이 좋습니다. 구조가 크게 바뀌면 상단의 디렉터리 요약과 라우팅 섹션을 우선 수정하세요.
