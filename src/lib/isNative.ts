//src/lib/isNative.ts
//..
export const isNative = () => {
    if (typeof window === 'undefined') return false;
  
    return !!window.Capacitor;
  };
  