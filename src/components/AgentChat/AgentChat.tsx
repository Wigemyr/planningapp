import { useEffect, useRef, useState } from 'react';
import { useAgent } from './useAgent';
import { Bot, Send, Trash2, Wrench, X, Sparkles } from '../icons';

interface Props {
  onClose: () => void;
}

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

  // Auto check-in when panel opens with an active session (once per mount)
  useEffect(() => {
    if (!hasCheckedIn.current && sessionGoal && !pendingQuestion && messages.length > 0) {
      hasCheckedIn.current = true;
      checkIn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolActivity, thinking, pendingQuestion]);

  // Focus goal input when it appears
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

  const isEmpty = messages.length === 0 && !thinking && !pendingQuestion;

  return (
    <div className="flex flex-col h-full w-80 border-l border-white/10 bg-[#111113]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {sessionGoal ? sessionGoal : 'Planning Agent'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowGoalInput((v) => !v)}
            title={sessionGoal ? 'Change session goal' : 'Start a session'}
            className="p-1.5 rounded text-zinc-500 hover:text-violet-400 hover:bg-white/5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {(messages.length > 0 || sessionGoal) && (
            <button
              onClick={clearSession}
              title="Clear session"
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* New session goal input */}
      {showGoalInput && (
        <div className="px-3 py-2 border-b border-white/10 bg-violet-950/30 shrink-0">
          <p className="text-[11px] text-violet-300 mb-1.5 font-medium">What are we working on?</p>
          <div className="flex gap-2">
            <input
              ref={goalInputRef}
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={handleGoalKeyDown}
              placeholder="e.g. implement user auth"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/60 transition-colors"
            />
            <button
              onClick={() => handleStartSession()}
              disabled={!goalInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Go
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        {isEmpty && (
          <div className="text-zinc-500 text-center mt-8 space-y-3">
            <Bot className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-zinc-400 font-medium">Your development companion</p>
            <p className="text-xs leading-relaxed">
              Set a session goal using the <Sparkles className="w-3 h-3 inline" /> button above,
              and I'll plan and work through it with you — asking when I need your input.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                msg.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 bg-violet-600 text-white text-sm'
                  : 'max-w-[95%] text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed'
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Tool activity */}
        {toolActivity.length > 0 && (
          <div className="space-y-1 pl-1">
            {toolActivity.map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-xs text-zinc-600">
                <Wrench className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  <span className={t.status === 'error' ? 'text-red-400' : 'text-zinc-500'}>
                    {t.tool}
                  </span>
                  {t.status === 'running' && (
                    <span className="ml-1 text-zinc-600 animate-pulse">running...</span>
                  )}
                  {t.status === 'done' && t.result && (
                    <span className="ml-1 text-zinc-700">{t.result}</span>
                  )}
                  {t.status === 'error' && t.result && (
                    <span className="ml-1 text-red-400">{t.result}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking dots */}
        {thinking && toolActivity.every((t) => t.status !== 'running') && (
          <div className="flex items-center gap-1 pl-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        {/* Pending question card */}
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
        <form onSubmit={handleSubmit} className="px-3 pb-3 pt-2 border-t border-white/10 shrink-0">
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-violet-500/50 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionGoal ? 'Say something…' : 'Ask or set a session goal above…'}
              disabled={thinking}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none max-h-32 disabled:opacity-50"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="shrink-0 p-1 rounded-lg text-violet-400 hover:text-violet-300 disabled:text-zinc-600 transition-colors disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-700 mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </form>
      )}
    </div>
  );
}

/** Prominent card shown when the agent is waiting for a user answer. */
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <Bot className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <div className="space-y-1 min-w-0">
          {context && (
            <p className="text-[11px] text-zinc-500 leading-relaxed">{context}</p>
          )}
          <p className="text-sm text-zinc-100 font-medium leading-snug">{question}</p>
        </div>
      </div>
      <div className="flex items-end gap-2 rounded-lg border border-violet-500/20 bg-white/5 px-3 py-2 focus-within:border-violet-500/50 transition-colors">
        <textarea
          ref={inputRef}
          rows={1}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Your answer…"
          className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none max-h-24"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button
          onClick={submit}
          disabled={!answer.trim()}
          className="shrink-0 p-1 rounded-lg text-violet-400 hover:text-violet-300 disabled:text-zinc-600 transition-colors disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
