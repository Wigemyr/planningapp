import { useEffect, useState } from 'react';
import { useUi } from '@/store/useUi';
import { AlertOctagon } from './icons';

/** Global confirm dialog — wired to useUi.confirmDialog.
 * Use openConfirm({ title, description, danger?, onConfirm }) from anywhere
 * to replace `window.confirm` calls. */
export function ConfirmDialog() {
  const cfg = useUi((s) => s.confirmDialog);
  const close = useUi((s) => s.closeConfirm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) close();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitting) void run();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, submitting]);

  // Reset submitting state when dialog opens
  useEffect(() => {
    if (cfg) setSubmitting(false);
  }, [cfg]);

  if (!cfg) return null;

  async function run() {
    if (!cfg) return;
    setSubmitting(true);
    try {
      await cfg.onConfirm();
      close();
    } catch (err) {
      console.error('[planning] confirm action failed', err);
      setSubmitting(false);
    }
  }

  const danger = cfg.danger === true;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4"
      style={{
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        paddingTop: '20vh',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) close();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-[420px] overflow-hidden"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--line-2)',
          borderRadius: 8,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {danger && (
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(198,110,107,0.12)',
                  border: '1px solid rgba(198,110,107,0.28)',
                }}
              >
                <AlertOctagon
                  className="w-4 h-4"
                  strokeWidth={1.75}
                  style={{ color: 'var(--sem-danger)' }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 id="confirm-title" className="text-[14.5px] font-semibold leading-tight">
                {cfg.title}
              </h2>
              {cfg.description && (
                <p className="text-[12.5px] text-ink-2 mt-1.5 leading-relaxed">
                  {cfg.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line"
          style={{ background: 'rgba(0,0,0,0.18)' }}
        >
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-[12.5px] px-3 py-1.5 rounded-md text-ink-2 hover:bg-white/[0.05] transition-colors disabled:opacity-50"
          >
            {cfg.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={submitting}
            className="text-[12.5px] font-medium px-3.5 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: danger ? 'rgba(198,110,107,0.18)' : 'var(--surface-4)',
              border: `1px solid ${danger ? 'rgba(198,110,107,0.42)' : 'var(--line-2)'}`,
              color: danger ? 'var(--sem-danger)' : 'var(--ink-1)',
            }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.background = danger
                ? 'rgba(198,110,107,0.26)'
                : 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = danger
                ? 'rgba(198,110,107,0.55)'
                : 'var(--line-3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = danger
                ? 'rgba(198,110,107,0.18)'
                : 'var(--surface-4)';
              e.currentTarget.style.borderColor = danger
                ? 'rgba(198,110,107,0.42)'
                : 'var(--line-2)';
            }}
          >
            {submitting ? 'Working…' : (cfg.confirmLabel ?? (danger ? 'Delete' : 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
}
