import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function LoginRoute() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-2.5 mb-7">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold text-white"
            style={{ background: '#7170ff' }}
            aria-hidden
          >
            P
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Planning</span>
        </div>

        <h1 className="text-[22px] leading-tight font-semibold tracking-tight mb-1.5">
          Sign in
        </h1>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-6">
          {!isSupabaseConfigured ? (
            <span className="text-[#fca5a5]">
              Supabase env vars are missing. Set <code className="text-ink">VITE_SUPABASE_URL</code>{' '}
              and <code className="text-ink">VITE_SUPABASE_ANON_KEY</code> (see{' '}
              <code className="text-ink">.env.example</code>) and reload.
            </span>
          ) : (
            <>
              Enter your email and we'll send you a magic link. No password needed.
            </>
          )}
        </p>

        {status === 'sent' ? (
          <div
            className="rounded-md border border-line bg-panel p-4"
            aria-live="polite"
          >
            <div className="text-[13px] font-medium mb-1">Check your inbox</div>
            <div className="text-[12.5px] text-ink-muted leading-relaxed">
              We sent a sign-in link to{' '}
              <span className="text-ink">{email}</span>. Click it to continue.
            </div>
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setEmail('');
              }}
              className="mt-3 text-[12px] text-accent hover:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[11.5px] text-ink-muted uppercase tracking-[0.14em] font-semibold">
                Email
              </span>
              <input
                type="email"
                autoFocus
                required
                disabled={!isSupabaseConfigured || status === 'sending'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full px-3 py-2 rounded-md bg-panel border border-line text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={!isSupabaseConfigured || status === 'sending' || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[13px] font-medium text-white bg-accent hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {errorMsg && (
              <p className="text-[12px] text-[#fca5a5]" role="alert">
                {errorMsg}
              </p>
            )}
          </form>
        )}

        <p className="text-[11px] text-ink-subtle mt-8 leading-relaxed">
          New here? The first link will create your account and a personal workspace.
          To join an existing team, sign in once first — the owner can then add you.
        </p>
      </div>
    </div>
  );
}
