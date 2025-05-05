'use client';

import { useEffect, useRef } from 'react';
import { PushNotifications, PermissionStatus } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';
import { getPlatform } from '@/lib/platform';

type SetBookmarkFunction = (title: string, index: number) => void;

export function usePushToken() {
  const registeredRef = useRef(false);

  useEffect(() => {
    // 웹이면 아예 스킵 (원할 때 web-push 추가)
    if (getPlatform() === 'web') return;

    // 두 번 이상 등록 방지
    if (registeredRef.current) return;
    registeredRef.current = true;

    const init = async () => {
      /* 1. 권한 요청 */
      const perm: PermissionStatus = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;

      /* 2. 토큰 요청 */
      await PushNotifications.register();

      /* 3. 성공 시 토큰 리스너 */
      const reg = await PushNotifications.addListener(
        'registration',
        async ({ value: token }) => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;

            // 플랫폼: ios | android
            const platform = Capacitor.getPlatform();

            await supabase
              .from('push_tokens')
              .upsert(
                {
                  user_id: user.id,
                  token,
                  platform,
                },
                { onConflict: 'user_id, platform' }
              );
          } catch (err) {
            console.error('🔴 push token upsert 실패', err);
          }
        }
      );

      /* 4. 토큰 갱신(삭제) 리스너 */
      const del = await PushNotifications.addListener(
        'registrationError',
        err => {
          console.error('🔴 push registration error', err);
        }
      );

      /* 5. 알림 클릭 */
      const act = await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        ({ notification }) => {
          // 👉 필요한 데이터에 맞춰 라우팅
          const { title, index } = notification.data ?? {};
          if (title && index !== undefined) {
            // 예시: 북마크 → /scripture
            const setBookmark = (window as unknown as { __NEXT_DATA__?: { props?: { pageProps?: { setBookmark?: SetBookmarkFunction } } } }).__NEXT_DATA__?.props?.pageProps?.setBookmark;
            try {
              setBookmark?.(title, Number(index));
            } catch {
              console.warn('setBookmark 를 찾을 수 없습니다');
            }
            location.href = '/scripture';
          }
        }
      );

      /* 6. 언마운트 클린업 */
      return () => {
        reg.remove();
        del.remove();
        act.remove();
      };
    };

    init();
  }, []);
}
