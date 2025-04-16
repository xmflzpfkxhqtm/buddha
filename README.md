# Buddha 프로젝트

이 프로젝트는 불교 텍스트를 Upstage 임베딩을 사용하여 Supabase에 저장하고, RAG(Retrieval-Augmented Generation) 기능을 제공합니다.

## 주요 기능

1. **텍스트 임베딩**: `/data` 폴더의 텍스트 파일을 Upstage AI를 사용하여 임베딩
2. **벡터 데이터베이스 저장**: 임베딩된 텍스트를 Supabase 벡터 데이터베이스에 저장
3. **의미 기반 검색**: 임베딩을 활용한 의미 기반 검색 API 제공

## API 엔드포인트

### 1. 데이터 임베딩 및 저장

- **URL**: `/api/embed`
- **Method**: GET
- **설명**: `/data` 폴더의 모든 .txt 파일을 임베딩하고 Supabase에 저장합니다.

### 2. 의미 기반 검색

- **URL**: `/api/search`
- **Method**: POST
- **Body**:
  ```json
  {
    "query": "검색할 텍스트",
    "limit": 5 (선택 사항, 기본값: 5)
  }
  ```
- **설명**: 입력된 텍스트와 의미적으로 유사한 문서를 검색합니다.

## 기술 스택

- **Frontend**: Next.js
- **AI 임베딩**: Upstage AI
- **데이터베이스**: Supabase (PostgreSQL + pgvector)

## 설치 및 실행

1. 의존성 설치:
   ```bash
   npm install
   ```

2. 개발 서버 실행:
   ```bash
   npm run dev
   ```

3. 텍스트 임베딩 처리:
   ```
   GET /api/embed
   ```

4. 검색 API 테스트:
   ```
   POST /api/search
   Body: { "query": "검색할 내용" }
   ```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
