import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Comment, User } from '@/lib/types';
import { Avatar } from './Avatar';
import { RichTextEditor, stripTags } from './RichTextEditor';
import { MessageSquare, Pencil, Trash2, Send, X, Check } from './icons';
import { formatAbsolute, formatRelative } from '@/lib/format';

/**
 * Discussion thread under an item. Workspace members can post HTML comments
 * (powered by the same RichTextEditor used for descriptions) and @-mention
 * each other. Authors can edit/delete their own; workspace owners can delete
 * any. Mentions are extracted from the trailing `@name` tokens at post time
 * and stored as an array of profile ids on the row.
 */
export function CommentSection({ itemId }: { itemId: string }) {
  const allComments = useStore((s) => s.comments);
  const users = useStore((s) => s.users);
  const currentUserId = useStore((s) => s.currentUserId);
  const members = useStore((s) => s.members);
  const addComment = useStore((s) => s.addComment);
  const updateComment = useStore((s) => s.updateComment);
  const deleteComment = useStore((s) => s.deleteComment);

  const [draft, setDraft] = useState('');
  // Forces a remount of the RichTextEditor after a successful post so its
  // internal contenteditable resets. Bumping the key is simpler than threading
  // an imperative `clear()` API through the editor.
  const [draftKey, setDraftKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const comments = useMemo(
    () =>
      allComments
        .filter((c) => c.itemId === itemId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [allComments, itemId],
  );

  const me = users.find((u) => u.id === currentUserId);

  const ownerIds = useMemo(
    () => new Set(members.filter((m) => m.role === 'owner').map((m) => m.user.id)),
    [members],
  );

  function extractMentions(html: string): string[] {
    const text = stripTags(html);
    const matches = text.matchAll(/@([\w._-]+)/g);
    const ids = new Set<string>();
    for (const m of matches) {
      const handle = m[1].toLowerCase();
      const hit = users.find(
        (u) =>
          u.name.toLowerCase() === handle ||
          u.email.split('@')[0].toLowerCase() === handle,
      );
      if (hit) ids.add(hit.id);
    }
    return [...ids];
  }

  async function handlePost() {
    if (!stripTags(draft)) return;
    setPosting(true);
    setErrorMsg(null);
    try {
      await addComment(itemId, draft, extractMentions(draft));
      setDraft('');
      setDraftKey((k) => k + 1);
    } catch (err) {
      setErrorMsg(
        'Could not post — ' + (err instanceof Error ? err.message : 'unknown'),
      );
    } finally {
      setPosting(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!stripTags(editDraft)) return;
    try {
      await updateComment(id, editDraft, extractMentions(editDraft));
      setEditingId(null);
      setEditDraft('');
    } catch (err) {
      setErrorMsg(
        'Could not save — ' + (err instanceof Error ? err.message : 'unknown'),
      );
    }
  }

  function beginEdit(c: Comment) {
    setEditingId(c.id);
    setEditDraft(c.body);
  }

  function canDelete(c: Comment): boolean {
    if (!currentUserId) return false;
    if (c.authorId === currentUserId) return true;
    return ownerIds.has(currentUserId);
  }

  return (
    <section className="mt-7 pt-6 border-t border-line">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-ink-muted" strokeWidth={1.75} />
        <h2 className="text-[14px] font-semibold">Discussion</h2>
        <span className="meta-text">{comments.length}</span>
      </div>

      {errorMsg && (
        <div className="mb-3 text-[12px] text-[#fca5a5] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] rounded px-2.5 py-1.5 flex items-center gap-2">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-0.5">
            <X className="w-3 h-3" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="flex gap-2 mb-5">
        <Avatar user={me} size={28} className="mt-1" />
        <div className="flex-1 min-w-0">
          <RichTextEditor
            key={draftKey}
            value={draft}
            onChange={setDraft}
            placeholder="Leave a comment. Use @name to mention someone."
            ariaLabel="New comment"
            minBodyHeight={70}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2 gap-3">
            <span className="text-[11px] text-ink-subtle">
              Tip: <span className="kbd">Ctrl</span> <span className="kbd">↵</span> to post · @name to mention
            </span>
            <button
              type="button"
              onClick={handlePost}
              disabled={posting || !stripTags(draft)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2.25} />
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>

      {/* Thread */}
      {comments.length === 0 ? (
        <p className="text-[12.5px] text-ink-subtle italic pl-10">
          No comments yet. Start the thread.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const author = users.find((u) => u.id === c.authorId);
            const editing = editingId === c.id;
            const edited =
              new Date(c.updatedAt).getTime() -
                new Date(c.createdAt).getTime() >
              1000;
            return (
              <li key={c.id} className="flex gap-2">
                <Avatar user={author} size={28} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                    <span className="text-[13px] font-medium text-ink">
                      {author?.name ?? '(unknown)'}
                    </span>
                    <span
                      className="text-[11px] text-ink-subtle"
                      title={formatAbsolute(c.createdAt)}
                    >
                      {formatRelative(c.createdAt)}
                    </span>
                    {edited && (
                      <span
                        className="text-[11px] text-ink-subtle italic"
                        title={`Edited ${formatAbsolute(c.updatedAt)}`}
                      >
                        · edited
                      </span>
                    )}
                    <div className="flex-1" />
                    {c.authorId === currentUserId && !editing && (
                      <button
                        type="button"
                        onClick={() => beginEdit(c)}
                        className="text-[11.5px] flex items-center gap-1 px-1.5 py-0.5 rounded text-ink-muted hover:text-ink-2 hover:bg-white/[0.04] transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Edit comment"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" strokeWidth={1.75} />
                      </button>
                    )}
                    {canDelete(c) && !editing && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        className="text-[11.5px] flex items-center gap-1 px-1.5 py-0.5 rounded text-ink-muted hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.06)] transition-colors"
                        aria-label="Delete comment"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>

                  {editing ? (
                    <>
                      <RichTextEditor
                        value={editDraft}
                        onChange={setEditDraft}
                        placeholder="Edit comment…"
                        ariaLabel="Edit comment"
                        minBodyHeight={70}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(c.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingId(null);
                          }
                        }}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(c.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors"
                        >
                          <Check className="w-3 h-3" strokeWidth={2.25} />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft('');
                          }}
                          className="text-[12px] px-2.5 py-1 rounded text-ink-2 hover:bg-white/[0.04] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <CommentBody body={c.body} users={users} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Render comment HTML and highlight @-mentions of known users. */
function CommentBody({ body, users }: { body: string; users: User[] }) {
  // Highlight @handle tokens by wrapping them in a styled span — done with a
  // string-level regex pass before injecting via dangerouslySetInnerHTML. The
  // input HTML is already constrained to the small whitelist that
  // RichTextEditor + paste sanitization produce, so this is safe.
  const decorated = useMemo(() => {
    const handles = new Map<string, User>();
    for (const u of users) {
      handles.set(u.name.toLowerCase(), u);
      handles.set(u.email.split('@')[0].toLowerCase(), u);
    }
    return body.replace(/@([\w._-]+)/g, (full, handle: string) => {
      const hit = handles.get(handle.toLowerCase());
      if (!hit) return full;
      return `<span class="mention" style="color:${hit.color};background:rgba(255,255,255,0.04);padding:0 4px;border-radius:3px;font-weight:500;">@${hit.name}</span>`;
    });
  }, [body, users]);

  return (
    <div
      className="rich-editor text-[13px] leading-[1.6] text-ink-2"
      // The body comes from execCommand-only output + our handle-decoration
      // pass; both sources produce a tight whitelist of tags.
      dangerouslySetInnerHTML={{ __html: decorated }}
    />
  );
}
