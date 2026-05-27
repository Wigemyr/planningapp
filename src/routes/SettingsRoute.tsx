import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Avatar } from '@/components/Avatar';
import { ArrowLeft, X, Plus, Check } from '@/components/icons';
import { formatRelative } from '@/lib/format';

export default function SettingsRoute() {
  const navigate = useNavigate();
  const currentUserId = useStore((s) => s.currentUserId);
  const members = useStore((s) => s.members);
  const invites = useStore((s) => s.invites);
  const inviteMember = useStore((s) => s.inviteMember);
  const revokeInvite = useStore((s) => s.revokeInvite);
  const removeMember = useStore((s) => s.removeMember);
  const refresh = useStore((s) => s.refreshMembersAndInvites);
  const workspace = useStore((s) => s.currentWorkspace());

  const currentMember = members.find((m) => m.user.id === currentUserId);
  const isOwner = currentMember?.role === 'owner';

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const result = await inviteMember(email);
      setFeedback({
        kind: 'success',
        msg:
          result.kind === 'added_existing'
            ? `${email.trim()} was already signed up — added to the workspace.`
            : `Invite saved. ${email.trim()} will join automatically the next time they sign in.`,
      });
      setEmail('');
    } catch (err) {
      setFeedback({
        kind: 'error',
        msg: err instanceof Error ? err.message : 'Failed to invite',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <header className="h-12 border-b border-line flex items-center px-4 gap-3 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[12.5px] px-1.5 py-1 rounded hover:bg-white/[0.04] text-ink-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Board
        </button>
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-ink-subtle">›</span>
          <span className="text-ink-muted">{workspace?.name}</span>
          <span className="text-ink-subtle">›</span>
          <span className="font-medium">Settings</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-8 py-7">
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight mb-1">
            Members & invites
          </h1>
          <p className="text-[13px] text-ink-2 leading-relaxed mb-6">
            {isOwner
              ? 'Add a teammate by email. If they already have an account, they’re added immediately. If not, we’ll add them automatically the moment they sign in.'
              : 'Only the workspace owner can change membership. You’re here in read-only.'}
          </p>

          {isOwner && (
            <form onSubmit={submit} className="flex items-center gap-2 mb-3">
              <input
                type="email"
                required
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-panel border border-line text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={!email.trim() || sending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[13px] font-medium text-white bg-accent hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                {sending ? 'Inviting…' : 'Invite'}
              </button>
            </form>
          )}

          {feedback && (
            <div
              className={`text-[12.5px] px-3 py-2 rounded-md mb-5 flex items-start gap-2 ${
                feedback.kind === 'success'
                  ? 'bg-[rgba(16,185,129,0.08)] text-[#86efac] border border-[rgba(16,185,129,0.2)]'
                  : 'bg-[rgba(239,68,68,0.08)] text-[#fca5a5] border border-[rgba(239,68,68,0.2)]'
              }`}
              role="status"
              aria-live="polite"
            >
              {feedback.kind === 'success' ? (
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
              ) : (
                <X className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
              )}
              <span className="flex-1">{feedback.msg}</span>
              <button
                onClick={() => setFeedback(null)}
                className="opacity-70 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Members section */}
          <section className="mt-6 pt-5 border-t border-line">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[14px] font-semibold">Members</h2>
              <span className="text-[11px] text-ink-muted tabular-nums">{members.length}</span>
            </div>
            <div className="divide-y divide-line rounded-md border border-line bg-panel">
              {members.length === 0 ? (
                <div className="px-4 py-6 text-[12.5px] text-ink-muted text-center">
                  No members yet
                </div>
              ) : (
                members.map((m) => (
                  <div key={m.user.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={m.user} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {m.user.name}
                        {m.user.id === currentUserId && (
                          <span className="text-[10.5px] text-ink-muted font-normal ml-1.5">(you)</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-ink-muted truncate">{m.user.email}</div>
                    </div>
                    <span
                      className="pill"
                      style={
                        m.role === 'owner'
                          ? { background: 'rgba(113,112,255,0.12)', color: '#7170ff' }
                          : { background: 'rgba(138,143,153,0.10)', color: '#8a8f99' }
                      }
                    >
                      {m.role}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Remove ${m.user.name} from this workspace?`)) {
                            try {
                              await removeMember(m.user.id);
                            } catch (err) {
                              setFeedback({
                                kind: 'error',
                                msg: err instanceof Error ? err.message : 'Failed to remove',
                              });
                            }
                          }
                        }}
                        className="text-[11.5px] text-ink-muted hover:text-[#ef4444] px-2 py-1 rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Invites section */}
          {(invites.length > 0 || isOwner) && (
            <section className="mt-7 pt-5 border-t border-line">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[14px] font-semibold">Pending invites</h2>
                <span className="text-[11px] text-ink-muted tabular-nums">{invites.length}</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => refresh()}
                  className="text-[11.5px] text-ink-muted hover:text-ink-2 px-2 py-1 rounded transition-colors"
                >
                  Refresh
                </button>
              </div>
              <div className="divide-y divide-line rounded-md border border-line bg-panel">
                {invites.length === 0 ? (
                  <div className="px-4 py-6 text-[12.5px] text-ink-muted text-center">
                    No pending invites
                  </div>
                ) : (
                  invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border border-dashed text-ink-muted"
                        style={{ borderColor: 'var(--line-2, #272b33)' }}
                      >
                        @
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{inv.email}</div>
                        <div className="text-[11.5px] text-ink-muted">
                          Invited {formatRelative(inv.createdAt)}
                        </div>
                      </div>
                      <span
                        className="pill"
                        style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}
                      >
                        pending
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await revokeInvite(inv.id);
                            } catch (err) {
                              setFeedback({
                                kind: 'error',
                                msg: err instanceof Error ? err.message : 'Failed to revoke',
                              });
                            }
                          }}
                          className="text-[11.5px] text-ink-muted hover:text-[#ef4444] px-2 py-1 rounded transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <div className="h-10" />
        </div>
      </div>
    </>
  );
}
