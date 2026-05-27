import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { LogOut } from '@/components/icons';

/**
 * Shown when an authenticated user is not yet a member of any workspace
 * AND there's no pending invite for their email. They've signed in, but the
 * workspace owner hasn't added them yet.
 */
export default function PendingInviteRoute() {
  const email = useStore((s) => s.currentUserEmail);
  const bootstrap = useStore((s) => s.bootstrap);
  const teardown = useStore((s) => s.teardown);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg">
      <div className="w-full max-w-[420px]">
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

        <h1 className="text-[22px] leading-tight font-semibold tracking-tight mb-2">
          You're signed in — but not yet invited.
        </h1>
        <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
          <span className="text-ink">{email}</span> isn't a member of any workspace
          yet. Ask the workspace owner to invite this email from their{' '}
          <span className="text-ink-2">Settings → Members</span> page. As soon as
          they do, refresh this page and you'll be in.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => bootstrap()}
            className="text-[13px] font-medium px-3 py-2 rounded-md text-white bg-accent hover:bg-accent-2 transition-colors"
          >
            Check again
          </button>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              await teardown();
            }}
            className="text-[13px] flex items-center gap-1.5 px-3 py-2 rounded-md text-ink-2 hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
