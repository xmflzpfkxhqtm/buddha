//src/lib/isNative.ts

export const isNative = () => {
    if (typeof window === 'undefined') return false;
  
    // ✅ 설명 붙인 ts-expect-error로 수정
    // @ts-expect-error: Capacitor is only available in native app runtime
    return !!window.Capacitor;
  };
  