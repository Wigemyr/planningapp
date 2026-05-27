import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import type { Notification, NotificationKind } from '@/lib/types';
import { Avatar } from './Avatar';
import { Bell, BellOff, CheckCheck, X } from './icons';
import { formatAbsolute, formatRelative } from '@/lib/format';

/**
 * Header bell + popover listing the signed-in user's notifications.
 *
 * Notifications are produced by DB triggers (see migration
 * `0004_notifications_table.sql`):
 *  - `assigned`              — someone set you as assignee on an item
 *  - `mentioned`             — someone @-mentioned you in a comment
 *  - `commented_on_assigned` — someone commented on an item assigned to you
 *
 * Clicking a row marks it as read and navigates to the item.
 */
export function NotificationBell() {
  const notifications = useStore((s) => s.notifications);
  const items = useStore((s) => s.items);
  const users = useStore((s) => s.users);
  const markRead = useStore((s) => s.markNotificationRead);
  const markAllRead = useStore((s) => s.markAllNotificationsRead);
  const dismiss = useStore((s) => s.dismissNotification);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...notifications].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notifications],
  );
  const unreadCount = sorted.filter((n) => !n.readAt).length;

  // Outside-click + Esc close
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleRowClick(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      markRead(n.id).catch((err) =>
        console.error('[planning] markNotificationRead failed', err),
      );
    }
    navigate(`/items/${n.itemId}`);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-ink-muted hover:text-ink-2 hover:bg-white/[0.05] transition-colors"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : 'Notifications'
        }
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
            : 'Notifications'
        }
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
            style={{
              background: 'var(--sem-danger)',
              boxShadow: '0 0 0 2px var(--bg)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+6px)] w-[360px] max-h-[480px] bg-panel border border-line shadow-2xl shadow-black/50 z-50 flex flex-col"
          style={{ borderRadius: 10 }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
            <div className="flex items-baseline gap-2">
              <h3 className="text-[13px] font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] text-ink-muted">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  markAllRead().catch((err) =>
                    console.error('[planning] markAllNotificationsRead failed', err),
                  )
                }
                className="text-[11.5px] flex items-center gap-1 px-1.5 py-0.5 rounded text-ink-muted hover:text-ink-2 hover:bg-white/[0.04] transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3 h-3" strokeWidth={2} />
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-subtle text-[12px]">
                <BellOff className="w-6 h-6" strokeWidth={1.5} />
                You're all caught up.
              </div>
            ) : (
              <ul>
                {sorted.map((n) => {
                  const item = items.find((i) => i.id === n.itemId);
                  const actor = users.find((u) => u.id === n.actorId);
                  const isUnread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      className={`group relative flex gap-2.5 px-3.5 py-2.5 border-b border-line cursor-pointer transition-colors ${
                        isUnread
                          ? 'bg-white/[0.025] hover:bg-white/[0.05]'
                          : 'hover:bg-white/[0.03]'
                      }`}
                      onClick={() => handleRowClick(n)}
                    >
                      {/* Unread dot */}
                      <span
                        className="mt-1.5 dot shrink-0"
                        style={{
                          width: 6,
                          height: 6,
                          background: isUnread ? 'var(--accent)' : 'transparent',
                        }}
                      />
                      <Avatar user={actor} size={26} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-ink-2 leading-snug">
                          <span className="font-medium text-ink">
                            {actor?.name ?? 'Someone'}
                          </span>{' '}
                          {sentenceFor(n.kind)}{' '}
                          {item && (
                            <>
                              <span className="meta-text">{item.shortId}</span>{' '}
                              <span className="text-ink">{item.title}</span>
                            </>
                          )}
                        </p>
                        <span
                          className="text-[11px] text-ink-subtle"
                          title={formatAbsolute(n.createdAt)}
                        >
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id).catch((err) =>
                            console.error('[planning] dismissNotification failed', err),
                          );
                        }}
                        className="absolute top-2 right-2 p-1 rounded text-ink-subtle hover:text-ink-2 hover:bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Dismiss notification"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function sentenceFor(kind: NotificationKind): string {
  switch (kind) {
    case 'assigned':
      return 'assigned you to';
    case 'mentioned':
      return 'mentioned you in';
    case 'commented_on_assigned':
      return 'commented on';
  }
}
