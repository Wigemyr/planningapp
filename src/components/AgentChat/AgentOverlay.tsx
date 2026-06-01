import { useEffect, useRef, useState } from 'react';
import { useAgent, type ToolActivity } from './useAgent';
import { useStore } from '@/store/useStore';
import {
  Bot, Send, Trash2, X, Sparkles, Wrench,
  ArrowDownUp, Plus, Link2, MessageSquare,
  Zap, Search, Book, Flag, CheckCheck,
} from '../icons';

const SUGGESTIONS = [
  { label: 'Analyze & organize my board', prompt: 'Analyze my full board. Set priorities, identify dependencies, move items to the right columns, and tell me what to focus on.' },
  { label: 'Plan next sprint', prompt: 'Look at my backlog and active items. Plan what I should work on this sprint — prioritize, sequence by dependencies, and set up the board.' },
  { label: 'Find and fix blockers', prompt: 'Find everything that is blocked or has unresolved dependencies. Fix what you can and ask me about what you cannot.' },
  { label: 'Prioritize everything', prompt: 'Go through every item on the board and assign the correct priority based on type, urgency, and dependencies. Use bulk update.' },
  { label: 'Add missing dependencies', prompt: 'Review all items and identify logical dependencies between them. Add them to the board.' },
  { label: 'Daily standup', prompt: 'Give me a standup: what is in progress, what is blocked, what should I work on next, and any risks I should know about.' },
];

function toolIcon(toolName: string) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (toolName) {
    case 'get_board_summary':   return <Search className={cls} />;
    case 'get_item_details':    return <Search className={cls} />;
    case 'update_item':         return <Flag className={cls} />;
    case 'bulk_update_items':   return <Zap className={cls} />;
    case 'move_item':           return <ArrowDownUp className={cls} />;
    case 'create_item':         return <Plus className={cls} />;
    case 'add_dependency':      return <Link2 className={cls} />;
    case 'remove_dependency':   return <Link2 className={cls} />;
    case 'add_comment':         return <MessageSquare className={cls} />;
    case 'update_session_notes':return <Book className={cls} />;
    case 'get_session_notes':   return <Book className={cls} />;
    default:                    return <Wrench className={cls} />;
  }
}

function toolLabel(toolName: string) {
  switch (toolName) {
    case 'get_board_summary':    return 'Analyzed board';
    case 'get_item_details':     return 'Inspected item';
    case 'update_item':          return 'Updated item';
    case 'bulk_update_items':    return 'Bulk updated items';
    case 'move_item':            return 'Moved item';
    case 'create_item':          return 'Created item';
    case 'add_dependency':       return 'Added dependency';
    case 'remove_dependency':    return 'Removed dependency';
    case 'add_comment':          return 'Left note on item';
    case 'update_session_notes': return 'Saved session notes';
    case 'get_session_notes':    return 'Read session notes';
    default:                     return toolName;
  }
}

function toolAccent(toolName: string): string {
  switch (toolName) {
    case 'create_item':          return 'var(--sem-success)';
    case 'move_item':            return 'var(--accent)';
    case 'bulk_update_items':
    case 'update_item':          return 'var(--sem-warn)';
    case 'add_dependency':
    case 'remove_dependency':    return '#a855f7';
    case 'add_comment':          return 'var(--ink-3)';
    default:                     return 'var(--ink-4)';
  }
}

interface LogEntry extends ToolActivity {
  timestamp: number;
}

interface Props {
  onClose: () => void;
}

export function AgentOverlay({ onClose }: Props) {
  const {
    messages, sessionGoal, sessionNotes, pendingQuestion,
    thinking, toolActivity,
    sendMessage, startSession, answerQuestion, checkIn, clearSession,
  } = useAgent();

  const items   = useStore((s) => s.items);
  const projects = useStore((s) => s.projects);

  const [input, setInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const activityEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const goalInputRef    = useRef<HTMLInputElement>(null);
  const hasCheckedIn    = useRef(false);
  const seenIds         = useRef(new Set<string>());

  // Accumulate completed tool calls across runs
  useEffect(() => {
    const finished = toolActivity.filter(
      (t) => (t.status === 'done' || t.status === 'error') && !seenIds.current.has(t.id),
    );
    if (finished.length === 0) return;
    finished.forEach((t) => seenIds.current.add(t.id));
    setActivityLog((prev) => [
      ...prev,
      ...finished.map((t) => ({ ...t, timestamp: Date.now() })),
    ]);
  }, [toolActivity]);

  // Auto check-in
  useEffect(() => {
    if (!hasCheckedIn.current && sessionGoal && !pendingQuestion && messages.length > 0) {
      hasCheckedIn.current = true;
      checkIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottoms
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); },
    [messages, thinking, pendingQuestion]);
  useEffect(() => { activityEndRef.current?.scrollIntoView({ behavior: 'smooth' }); },
    [activityLog]);

  useEffect(() => { if (showGoalInput) goalInputRef.current?.focus(); }, [showGoalInput]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }

  function handleStartSession(e?: React.FormEvent) {
    e?.preventDefault();
    const goal = goalInput.trim();
    if (!goal) return;
    setGoalInput('');
    setShowGoalInput(false);
    startSession(goal);
  }

  function handleClearSession() {
    clearSession();
    setActivityLog([]);
    seenIds.current.clear();
  }

  const activeCount  = items.filter((i) => i.status === 'active').length;
  const blockedCount = items.filter((i) => i.status === 'blocked').length;
  const waitingCount = items.filter((i) => i.status === 'waiting').length;
  const backlogCount = items.filter((i) => i.status === 'backlog').length;
  const isEmpty      = messages.length === 0 && !thinking && !pendingQuestion;

  // Running tool name for the inline indicator
  const runningTool = toolActivity.find((t) => t.status === 'running');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 'min(92vw, 1180px)',
          height: 'min(90vh, 840px)',
          background: 'var(--bg)',
          border: '1px solid var(--line-2)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid var(--line-1)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(91,141,239,0.12)' }}
          >
            <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>

          <div className="flex-1 min-w-0">
            {sessionGoal ? (
              <span
                className="text-sm font-semibold truncate block"
                style={{ color: 'var(--ink-1)', letterSpacing: '-0.012em' }}
              >
                {sessionGoal}
              </span>
            ) : (
              <span className="text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
                Planning Agent
              </span>
            )}
          </div>

          {/* Live board stats */}
          <div className="hidden sm:flex items-center gap-2">
            {[
              { label: 'Active',  count: activeCount,  color: 'var(--sem-success)' },
              { label: 'Blocked', count: blockedCount, color: 'var(--sem-danger)'  },
              { label: 'Waiting', count: waitingCount, color: 'var(--sem-warn)'    },
              { label: 'Backlog', count: backlogCount, color: 'var(--ink-4)'       },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setShowGoalInput((v) => !v)}
              title="Set session goal"
              className="p-2 rounded-lg transition-colors text-[11px] flex items-center gap-1.5"
              style={{ color: showGoalInput ? 'var(--accent)' : 'var(--ink-4)', background: showGoalInput ? 'var(--surface-2)' : 'transparent' }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sessionGoal ? 'Change goal' : 'Set goal'}</span>
            </button>
            {(messages.length > 0 || sessionGoal) && (
              <button
                onClick={handleClearSession}
                title="Clear session"
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--ink-4)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--ink-4)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Goal input bar ── */}
        {showGoalInput && (
          <div
            className="px-5 py-3 shrink-0 flex items-center gap-3"
            style={{ borderBottom: '1px solid var(--line-1)', background: 'var(--surface-1)' }}
          >
            <span className="text-[12px] shrink-0" style={{ color: 'var(--ink-3)' }}>
              What are we working on?
            </span>
            <input
              ref={goalInputRef}
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartSession();
                if (e.key === 'Escape') setShowGoalInput(false);
              }}
              placeholder="e.g. implement user authentication"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{
                color: 'var(--ink-1)',
                borderBottom: '1px solid var(--line-3)',
                paddingBottom: 2,
              }}
            />
            <button
              onClick={() => handleStartSession()}
              disabled={!goalInput.trim()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Start
            </button>
          </div>
        )}

        {/* ── Main body ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left: Conversation ── */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ flex: '1 1 0', borderRight: '1px solid var(--line-1)' }}
          >
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

              {/* Empty state */}
              {isEmpty && (
                <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
                  <div className="text-center space-y-2">
                    <div
                      className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <Bot className="w-6 h-6" style={{ color: 'var(--ink-3)' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                      Ready to work
                    </p>
                    <p className="text-[12.5px] max-w-xs text-center" style={{ color: 'var(--ink-4)', lineHeight: 1.6 }}>
                      Set a goal with the ✦ button, or pick something below to get started.
                    </p>
                  </div>
                  <div className="w-full max-w-sm space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => sendMessage(s.prompt)}
                        disabled={thinking}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl text-[12.5px] transition-colors"
                        style={{
                          background: 'var(--surface-1)',
                          border: '1px solid var(--line-1)',
                          color: 'var(--ink-2)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--surface-2)';
                          e.currentTarget.style.borderColor = 'var(--line-2)';
                          e.currentTarget.style.color = 'var(--ink-1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--surface-1)';
                          e.currentTarget.style.borderColor = 'var(--line-1)';
                          e.currentTarget.style.color = 'var(--ink-2)';
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  {msg.role === 'user' ? (
                    <div
                      className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="max-w-[92%] text-[13px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}

              {/* Active tool indicator */}
              {runningTool && (
                <div className="flex items-center gap-2" style={{ color: 'var(--ink-4)' }}>
                  <span className="flex gap-1">
                    {[0, 120, 240].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: 'var(--accent)', animationDelay: `${d}ms`, opacity: 0.7 }}
                      />
                    ))}
                  </span>
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>
                    {toolLabel(runningTool.tool)}…
                  </span>
                </div>
              )}

              {/* Thinking (no active tool) */}
              {thinking && !runningTool && (
                <div className="flex items-center gap-1.5">
                  {[0, 120, 240].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--ink-4)', animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              )}

              {/* Pending question */}
              {pendingQuestion && !thinking && (
                <PendingQuestionCard
                  question={pendingQuestion.question}
                  context={pendingQuestion.context}
                  onAnswer={answerQuestion}
                />
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!pendingQuestion && (
              <form
                onSubmit={handleSubmit}
                className="px-4 pb-4 pt-3 shrink-0"
                style={{ borderTop: '1px solid var(--line-1)' }}
              >
                <div
                  className="flex items-end gap-2 rounded-xl px-4 py-2.5 transition-colors"
                  style={{ background: 'var(--surface-1)', border: '1px solid var(--line-2)' }}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={thinking ? 'Agent is working…' : 'Message the agent…'}
                    disabled={thinking}
                    className="flex-1 resize-none bg-transparent text-[13px] outline-none max-h-36 disabled:opacity-40"
                    style={{ color: 'var(--ink-1)', fieldSizing: 'content' } as React.CSSProperties}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || thinking}
                    className="shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: 'var(--accent)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10.5px] mt-1.5 text-center" style={{ color: 'var(--ink-4)' }}>
                  Enter to send · Shift+Enter for new line · Esc to close
                </p>
              </form>
            )}
          </div>

          {/* ── Right: Activity feed ── */}
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={{ width: 'clamp(260px, 30%, 340px)', background: 'var(--surface-1)' }}
          >
            <div
              className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider shrink-0"
              style={{ color: 'var(--ink-4)', borderBottom: '1px solid var(--line-1)' }}
            >
              Activity
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {activityLog.length === 0 && !thinking && (
                <div className="text-center py-8 space-y-2">
                  <CheckCheck className="w-5 h-5 mx-auto" style={{ color: 'var(--ink-4)' }} />
                  <p className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>
                    No activity yet. Start a session to see the agent work in real time.
                  </p>
                </div>
              )}

              {activityLog.map((entry, i) => (
                <div
                  key={`${entry.id}-${i}`}
                  className="rounded-lg px-3 py-2.5 space-y-1"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line-1)' }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: toolAccent(entry.tool) }}>
                      {toolIcon(entry.tool)}
                    </span>
                    <span className="text-[11.5px] font-medium" style={{ color: 'var(--ink-2)' }}>
                      {toolLabel(entry.tool)}
                    </span>
                    {entry.status === 'error' && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(198,110,107,0.12)', color: 'var(--sem-danger)' }}>
                        error
                      </span>
                    )}
                  </div>
                  {entry.result && entry.tool !== 'get_board_summary' && entry.tool !== 'get_session_notes' && (
                    <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'var(--ink-4)' }}>
                      {entry.result}
                    </p>
                  )}
                </div>
              ))}

              {/* Running entry */}
              {toolActivity.filter((t) => t.status === 'running').map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg px-3 py-2.5 flex items-center gap-2"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}
                >
                  <span style={{ color: toolAccent(t.tool) }}>{toolIcon(t.tool)}</span>
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    {toolLabel(t.tool)}
                  </span>
                  <span className="ml-auto flex gap-1">
                    {[0, 100, 200].map((d) => (
                      <span
                        key={d}
                        className="w-1 h-1 rounded-full animate-bounce"
                        style={{ background: 'var(--accent)', animationDelay: `${d}ms` }}
                      />
                    ))}
                  </span>
                </div>
              ))}

              <div ref={activityEndRef} />
            </div>

            {/* Session notes */}
            {sessionNotes && (
              <div
                className="shrink-0 px-4 py-3 space-y-1.5"
                style={{ borderTop: '1px solid var(--line-1)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                  Session notes
                </p>
                <p className="text-[11.5px] leading-relaxed line-clamp-4 whitespace-pre-wrap" style={{ color: 'var(--ink-3)' }}>
                  {sessionNotes}
                </p>
              </div>
            )}

            {/* Projects list */}
            {projects.filter((p) => !p.deletedAt).length > 0 && (
              <div
                className="shrink-0 px-4 py-3"
                style={{ borderTop: '1px solid var(--line-1)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>
                  Projects
                </p>
                <div className="space-y-1">
                  {projects.filter((p) => !p.deletedAt).map((p) => {
                    const count = items.filter((i) => i.projectId === p.id && i.status !== 'resolved').length;
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="tabular-nums" style={{ color: 'var(--ink-4)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingQuestionCard({
  question, context, onAnswer,
}: {
  question: string;
  context?: string;
  onAnswer: (a: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  function submit() {
    const t = answer.trim();
    if (!t) return;
    setAnswer('');
    onAnswer(t);
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--line-2)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'rgba(91,141,239,0.12)' }}
        >
          <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="space-y-1">
          {context && (
            <p className="text-[12px]" style={{ color: 'var(--ink-4)', lineHeight: 1.5 }}>{context}</p>
          )}
          <p className="text-[13px] font-medium" style={{ color: 'var(--ink-1)', lineHeight: 1.5 }}>
            {question}
          </p>
        </div>
      </div>
      <div
        className="flex items-end gap-2 rounded-lg px-3.5 py-2.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Your answer…"
          className="flex-1 resize-none bg-transparent text-[13px] outline-none max-h-24"
          style={{ color: 'var(--ink-1)', fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={submit}
          disabled={!answer.trim()}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{ color: 'var(--accent)' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
