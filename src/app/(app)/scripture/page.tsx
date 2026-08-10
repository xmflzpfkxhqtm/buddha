// 구버전 /scripture 라우트 — /scripture/v2 로 redirect
import { redirect } from 'next/navigation';

export default function ScriptureLegacyPage() {
  redirect('/scripture/v2');
}
