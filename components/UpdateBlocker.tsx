'use client';

import { Capacitor } from '@capacitor/core';
import useVersionCheck from '@/hooks/useVersionCheck';

export default function UpdateBlocker() {
  const { blocking } = useVersionCheck();
  if (!blocking) return null;

  /* 플랫폼별 문구 분기 */
  const platform = Capacitor.getPlatform();               // 'ios' | 'android'
  const storeName =
    platform === 'ios'      ? 'App Store'
  : platform === 'android'  ? 'Play 스토어'
                            : '스토어';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F5F1E6]">
      <p className="text-lg font-bold mb-2">업데이트가 필요합니다</p>

      <p className="text-sm text-gray-600 mb-6 text-center px-6">
        최신 버전을 설치하신 뒤 다시 시도해 주세요.
        <br />
        ({storeName}로 자동 이동되지 않았다면, 수동으로 열어 업데이트하시면 됩니다)
      </p>

      <button
        onClick={() => location.reload()}
        className="px-4 py-2 rounded-md bg-red-600 text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
