export const isNative = () => {
    if (typeof window === 'undefined') return false;
  
    // @ts-ignore
    return !!window.Capacitor;
  };
  