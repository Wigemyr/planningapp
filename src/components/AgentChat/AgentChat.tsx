import { useEffect, useRef, useState } from 'react';
import { useAgent } from './useAgent';
import { Bot, Send, Trash2, Wrench, X, Sparkles } from '../icons';

interface Props {
  onClose: () => void;
}

const SUGGESTIONS = [
  { label: 'Review my board', prompt: 'Review my board and tell me what needs attention.' },
  { label: 'Plan next sprint', prompt: 'Look at my backlog and help me plan what to work on next.' },
  { label: 'Clear blockers', prompt: 'Find everything that is blocked and help me figure out how to unblock it.' },
  { label: 'Prioritize backlog', prompt: 'Review my backlog and set priorities based on type and importance.' },
  { label: 'Break down tasks', prompt: 'Find any vague tasks and help me break them into concrete steps.' },
  { label: 'Daily standup', prompt: 'Give me a quick standup summary — what\'s in progress, what\'s blocked, what\'s next.' },
];

export function AgentChat({ onClose }: Props) {
  const {
    messages,
    sessionGoal,
    pendingQuestion,
    thinking,
    toolActivity,
    sendMessage,
    startSession,
    answerQuestion,
    checkIn,
    clearSession,
  } = useAgent();

  const [input, setInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [showGoalInput, setShowGoalInput] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const goalInputRef = useRef<HTMLInputElement>(null);
  const hasCheckedIn = useRef(false);

  useEffect(() => {
    if (!hasCheckedIn.current && sessionGoal && !pendingQuestion && messages.length > 0) {
      hasCheckedIn.current = true;
      checkIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolActivity, thinking, pendingQuestion]);

  useEffect(() => {
    if (showGoalInput) goalInputRef.current?.focus();
  }, [showGoalInput]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleStartSession(e?: React.FormEvent) {
    e?.preventDefault();
    const goal = goalInput.trim();
    if (!goal) return;
    setGoalInput('');
    setShowGoalInput(false);
    startSession(goal);
  }

  function handleGoalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleStartSession();
    if (e.key === 'Escape') setShowGoalInput(false);
  }

  function handleSuggestion(prompt: string) {
    sendMessage(prompt);
  }

  const isEmpty = messages.length === 0 && !thinking && !pendingQuestion;

  return (
    <div className="flex flex-col h-full border-l" style={{ borderColor: 'var(--line-2)', background: 'var(--bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--line-1)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.15)' }}>
            <Bot className="w-3 h-3" style={{ color: 'var(--accent)' }} />
          </div>
          <span className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
            {sessionGoal || 'Planning Agent'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setShowGoalInput((v) => !v)}
            title="Set session goal"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: showGoalInput ? 'var(--accent)' : 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {(messages.length > 0 || sessionGoal) && (
            <button
              onClick={clearSession}
              title="Clear session"
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--ink-4)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--ink-4)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Session goal input */}
      {showGoalInput && (
        <div className="px-3 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--line-1)', background: 'var(--surface-1)' }}>
          <p className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--ink-3)' }}>
            What are we working on?
          </p>
          <div className="flex gap-2">
            <input
              ref={goalInputRef}
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={handleGoalKeyDown}
              placeholder="e.g. implement user auth"
              className="flex-1 text-sm rounded-md px-2.5 py-1.5 outline-none transition-colors"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line-2)',
                color: 'var(--ink-1)',
              }}
            />
            <button
              onClick={() => handleStartSession()}
              disabled={!goalInput.trim()}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Go
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">

        {/* Empty state with suggestions */}
        {isEmpty && (
          <div className="space-y-4 pt-2">
            <div className="text-center space-y-1.5">
              <div className="w-8 h-8 rounded-xl mx-auto flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                <Bot className="w-4 h-4" style={{ color: 'var(--ink-3)' }} />
              </div>
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--ink-2)' }}>Your development companion</p>
              <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-4)' }}>
                Set a goal with ✦ above, or try one of these:
              </p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s.prompt)}
                  className="w-full text-left px-3 py-2 rounded-lg text-[12px] transition-colors"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--line-1)',
                    color: 'var(--ink-2)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface-2)';
                    e.currentTarget.style.borderColor = 'var(--line-2)';
                    e.currentTarget.style.color = 'var(--ink-1)';
                  }}
                  onMouseLeave={e => {
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

        {/* Message history */}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {msg.role === 'user' ? (
              <div
                className="max-w-[88%] rounded-2xl rounded-tr-sm px-3 py-2 text-[12.5px] text-white leading-relaxed"
                style={{ background: 'var(--accent)' }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                className="max-w-[96%] text-[12.5px] leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--ink-2)' }}
              >
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {/* Tool activity */}
        {toolActivity.length > 0 && (
          <div className="space-y-1 py-0.5">
            {toolActivity.map((t) => (
              <div key={t.id} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--ink-4)' }}>
                <Wrench className="w-3 h-3 shrink-0 mt-px" />
                <span>
                  <span style={{ color: t.status === 'error' ? 'var(--sem-danger)' : 'var(--ink-4)' }}>
                    {t.tool}
                  </span>
                  {t.status === 'running' && (
                    <span className="animate-pulse"> running…</span>
                  )}
                  {t.status === 'done' && t.result && (
                    <span style={{ color: 'var(--ink-4)' }}> — {t.result}</span>
                  )}
                  {t.status === 'error' && t.result && (
                    <span style={{ color: 'var(--sem-danger)' }}> {t.result}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking dots */}
        {thinking && toolActivity.every((t) => t.status !== 'running') && (
          <div className="flex items-center gap-1 py-1">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: 'var(--ink-4)', animationDelay: `${delay}ms` }}
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

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!pendingQuestion && (
        <form onSubmit={handleSubmit} className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid var(--line-1)' }}>
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2 transition-colors"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--line-2)' }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionGoal ? 'Say something…' : 'Ask or use a suggestion above…'}
              disabled={thinking}
              className="flex-1 resize-none bg-transparent text-[12.5px] outline-none max-h-28 disabled:opacity-50"
              style={{ color: 'var(--ink-1)', fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="shrink-0 p-1 rounded-md transition-colors disabled:opacity-30"
              style={{ color: 'var(--accent)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--ink-4)' }}>
            Enter to send · Shift+Enter for new line
          </p>
        </form>
      )}
    </div>
  );
}

function PendingQuestionCard({
  question,
  context,
  onAnswer,
}: {
  question: string;
  context?: string;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function submit() {
    const trimmed = answer.trim();
    if (!trimmed) return;
    setAnswer('');
    onAnswer(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--surface-1)', border: '1px solid var(--line-2)' }}>
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.15)' }}>
          <Bot className="w-3 h-3" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="space-y-1 min-w-0">
          {context && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink-4)' }}>{context}</p>
          )}
          <p className="text-[12.5px] font-medium leading-snug" style={{ color: 'var(--ink-1)' }}>
            {question}
          </p>
        </div>
      </div>
      <div
        className="flex items-end gap-2 rounded-lg px-3 py-2 transition-colors"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--line-2)' }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your answer…"
          className="flex-1 resize-none bg-transparent text-[12.5px] outline-none max-h-24"
          style={{ color: 'var(--ink-1)', fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={submit}
          disabled={!answer.trim()}
          className="shrink-0 p-1 rounded-md transition-colors disabled:opacity-30"
          style={{ color: 'var(--accent)' }}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
