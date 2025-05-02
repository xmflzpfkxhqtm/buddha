import '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface SignInWithOAuthOptions {
    options?: {
      redirectTo?: string;
      scopes?: string;
      queryParams?: { [key: string]: string };
      skipBrowserRedirect?: boolean;
      flowType?: 'pkce' | 'implicit';
    };
  }
} 