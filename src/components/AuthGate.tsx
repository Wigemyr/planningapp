import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import LoginRoute from '@/routes/LoginRoute';
import { useStore } from '@/store/useStore';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const bootstrap = useStore((s) => s.bootstrap);
  const teardown = useStore((s) => s.teardown);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (active) setSession(sess);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Boot data after we have a session; tear down on sign-out.
  useEffect(() => {
    if (session === undefined) return;
    if (session) {
      bootstrap();
    } else {
      teardown();
    }
  }, [session?.user?.id, bootstrap, teardown, session]);

  if (session === undefined) {
    // Initial session probe in flight — render a small skeleton so we don't
    // briefly flash the login screen for already-signed-in users.
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-muted text-[13px]">
        Loading…
      </div>
    );
  }
  if (session === null) {
    return <LoginRoute />;
  }
  return <>{children}</>;
}
