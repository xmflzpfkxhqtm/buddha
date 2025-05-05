'use client';

import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';

export default function PushDebug() {
  useEffect(() => {
    // ① 권한 요청
    PushNotifications.requestPermissions().then(async perm => {
      console.log('🔥 permission', perm.receive);
      if (perm.receive === 'granted') {
        await PushNotifications.register();   // ② 토큰 요청
      }
    });

    // ③ 토큰 수신
    PushNotifications.addListener('registration', ({ value }) => {
      console.log('🔥 FCM token', value);
    });

    // ④ 에러 수신
    PushNotifications.addListener('registrationError', err => {
      console.error('🔥 registrationError', JSON.stringify(err));
    });
  }, []);

  return null; // 화면에 아무것도 보여줄 필요 없음
}
