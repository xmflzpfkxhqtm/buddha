'use client';

import { useEffect, useState } from 'react';
import {
  Capacitor,
  type PluginListenerHandle,
} from '@capacitor/core';
import { App }     from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import compare     from 'semver/functions/compare';
import coerce      from 'semver/functions/coerce';

import { supabase } from '@/lib/supabaseClient';

/* ─────────────────────────────────────────────
 *  Supabase row 타입
 * ───────────────────────────────────────────── */
interface Row {
  min_version:    string;   // 차단 기준
  latest_version: string;   // 권장 업데이트(선택)
  store_url:      string;   // App/Play 스토어 URL
}

/* ─────────────────────────────────────────────
 *  iOS · Android 공용 “최소 버전” 체크 Hook
 * ───────────────────────────────────────────── */
export default function useVersionCheck() {
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    let listener: PluginListenerHandle | undefined;

    /* ───────── 버전 체크 로직 ───────── */
    const run = async () => {
      const platform = Capacitor.getPlatform();          // 'ios' | 'android' | 'web'
      if (platform === 'web') return;                    // 웹 브라우저는 패스

      /* ① 로컬 앱 버전
       *    - "1.2" · "1.2 (10)" 등 SemVer가 아닐 수 있어 coerce() 보정 */
      const { version } = await App.getInfo();           // ex) "1.2 (42)"
      const local = coerce(version)?.version ?? version; // → "1.2.0"

      /* ② 원격 최소 버전 가져오기 */
      const { data } = await supabase
        .from('app_versions')
        .select('min_version, latest_version, store_url')
        .eq('platform', platform)                        // ← 동적 플랫폼
        .single<Row>();

      if (!data) return;                                 // 쿼리 실패 시 패스

      /* ③ 비교 → 차단 여부 결정 */
      if (compare(local, data.min_version) < 0) {
        setBlocking(true);                               // UI 가리기
        await Browser.open({ url: data.store_url });     // 스토어 열기
      }
    };

    /* ─── 최초 진입 시 실행 ─── */
    run();

    /* ─── 포그라운드 복귀 시도마다 재확인 ─── */
    void (async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) run();
      });
    })();

    /* ─── 클린업 ─── */
    return () => {
      listener?.remove();
    };
  }, []);

  return { blocking };   // true면 <UpdateBlocker/>에서 전체 오버레이
}
