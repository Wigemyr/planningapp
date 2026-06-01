import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AGENT_TOOLS, executeTool, type ToolInput, type AgentContext } from './agentTools';
import { useStore } from '@/store/useStore';

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/claude-proxy`;

const STORAGE = {
  messages: 'planning.agent.messages',
  sessionGoal: 'planning.agent.sessionGoal',
  sessionNotes: 'planning.agent.sessionNotes',
  pendingQuestion: 'planning.agent.pendingQuestion',
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolActivity {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  result?: string;
}

export interface PendingQuestion {
  id: string;
  question: string;
  context?: string;
  /** Saved Anthropic API message history up to and including the ask_user tool_use block. */
  savedApiHistory: unknown[];
  toolUseId: string;
}

// Internal Anthropic API message shape
type ApiMessage = { role: 'user' | 'assistant'; content: unknown };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function useAgent() {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadJson<ChatMessage[]>(STORAGE.messages, []),
  );
  const [sessionGoal, setSessionGoal] = useState<string>(() =>
    loadJson<string>(STORAGE.sessionGoal, ''),
  );
  const [sessionNotes, setSessionNotes] = useState<string>(() =>
    loadJson<string>(STORAGE.sessionNotes, ''),
  );
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(() =>
    loadJson<PendingQuestion | null>(STORAGE.pendingQuestion, null),
  );
  const [thinking, setThinking] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);

  // Non-persisted API history — rebuilt per session. pendingQuestion carries
  // the history needed for resumption after a pause.
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);

  const projects = useStore((s) => s.projects);
  const items = useStore((s) => s.items);

  // Use a ref for sessionNotes so the agentic loop always reads the latest value
  const sessionNotesRef = useRef(sessionNotes);
  sessionNotesRef.current = sessionNotes;

  // Persist on change
  useEffect(() => { saveJson(STORAGE.messages, messages); }, [messages]);
  useEffect(() => { saveJson(STORAGE.sessionGoal, sessionGoal); }, [sessionGoal]);
  useEffect(() => { saveJson(STORAGE.sessionNotes, sessionNotes); }, [sessionNotes]);
  useEffect(() => { saveJson(STORAGE.pendingQuestion, pendingQuestion); }, [pendingQuestion]);

  function buildSystemPrompt(goal: string) {
    const projectList = projects
      .filter((p) => !p.deletedAt)
      .map((p) => `  - id=${p.id} name="${p.name}" prefix=${p.shortPrefix}`)
      .join('\n');
    const activeCount = items.filter((i) => i.status === 'active').length;
    const blockedCount = items.filter((i) => i.status === 'blocked').length;
    const backlogCount = items.filter((i) => i.status === 'backlog').length;

    return `You are a proactive AI development companion and planning agent embedded in a kanban board app. You work alongside the user as they build their project — like a smart co-founder who keeps things organised and on track.

${goal ? `Current session goal: "${goal}"` : 'No session goal set yet.'}

Board snapshot:
- Total items: ${items.length} (active: ${activeCount}, blocked: ${blockedCount}, backlog: ${backlogCount})
- Projects:\n${projectList || '  (none)'}

How you work:
- You have a goal for this session. Work toward it systematically.
- Use get_board_summary before making decisions to get fresh data.
- Make changes on the board autonomously — create tasks, set priorities, move items.
- When you hit a decision point or need information you cannot infer, use ask_user to pause and ask. Be specific.
- Save your working notes with update_session_notes so you can resume after answering questions.
- Keep the user focused. If they start talking about something unrelated to the session goal, gently redirect.
- Be direct and concise. No fluff. No excessive explanation.

Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
  }

  /** Core agentic loop. Continues until end_turn or ask_user. */
  async function runAgentLoop(
    workingHistory: ApiMessage[],
    goal: string,
    token: string,
  ): Promise<ApiMessage[]> {
    const agentContext: AgentContext = {
      get sessionNotes() { return sessionNotesRef.current; },
      onSessionNotesUpdate: (notes) => {
        setSessionNotes(notes);
        sessionNotesRef.current = notes;
      },
    };

    while (true) {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: buildSystemPrompt(goal),
          tools: AGENT_TOOLS,
          messages: workingHistory,
        }),
      });

      const data = await response.json() as {
        stop_reason: string;
        content: Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
        }>;
        error?: { message: string };
      };

      if (!response.ok) {
        throw new Error(data.error?.message ?? `HTTP ${response.status}`);
      }

      workingHistory = [...workingHistory, { role: 'assistant', content: data.content }];

      if (data.stop_reason === 'end_turn') {
        const text = data.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('\n')
          .trim();
        if (text) {
          setMessages((m) => [...m, { role: 'assistant', content: text }]);
        }
        return workingHistory;
      }

      if (data.stop_reason === 'tool_use') {
        const toolBlocks = data.content.filter((b) => b.type === 'tool_use');
        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

        for (const block of toolBlocks) {
          const activityId = block.id ?? Math.random().toString(36).slice(2);
          const toolName = block.name ?? '';

          // ask_user is special — pause the loop, persist state, and exit
          if (toolName === 'ask_user') {
            const { question, context: ctx } = block.input as {
              question: string;
              context?: string;
            };
            const pq: PendingQuestion = {
              id: activityId,
              question,
              context: ctx,
              savedApiHistory: workingHistory,
              toolUseId: block.id ?? '',
            };
            setPendingQuestion(pq);
            setThinking(false);
            return workingHistory;
          }

          setToolActivity((prev) => [
            ...prev,
            { id: activityId, tool: toolName, status: 'running' },
          ]);

          let result: string;
          let status: 'done' | 'error' = 'done';
          try {
            result = await executeTool(toolName, block.input as ToolInput, agentContext);
          } catch (err) {
            result = `Error: ${err instanceof Error ? err.message : String(err)}`;
            status = 'error';
          }

          setToolActivity((prev) =>
            prev.map((t) => (t.id === activityId ? { ...t, status, result } : t)),
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id ?? '',
            content: result,
          });
        }

        workingHistory = [...workingHistory, { role: 'user', content: toolResults }];
        continue;
      }

      break;
    }

    return workingHistory;
  }

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  /** Send a regular user message. */
  const sendMessage = useCallback(
    async (userText: string) => {
      const token = await getToken();
      if (!token) {
        setMessages((m) => [...m, { role: 'assistant', content: 'Not authenticated.' }]);
        return;
      }

      const userMsg: ChatMessage = { role: 'user', content: userText };
      setMessages((m) => [...m, userMsg]);
      setThinking(true);
      setToolActivity([]);

      const currentHistory: ApiMessage[] = [...apiHistory, { role: 'user', content: userText }];

      try {
        const finalHistory = await runAgentLoop(currentHistory, sessionGoal, token);
        setApiHistory(finalHistory);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiHistory, sessionGoal, projects, items],
  );

  /** Start or update the session goal and kick off the agent. */
  const startSession = useCallback(
    async (goal: string) => {
      const token = await getToken();
      if (!token) return;

      const trimmed = goal.trim();
      setSessionGoal(trimmed);
      setSessionNotes('');
      setPendingQuestion(null);
      setToolActivity([]);

      const kickoff = `Session goal: "${trimmed}"\n\nReview my board, make a plan for this session, and start working. Use ask_user if you hit a decision point.`;
      setMessages((m) => [...m, { role: 'user', content: `Let's work on: ${trimmed}` }]);
      setThinking(true);

      const history: ApiMessage[] = [{ role: 'user', content: kickoff }];

      try {
        const finalHistory = await runAgentLoop(history, trimmed, token);
        setApiHistory(finalHistory);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, items],
  );

  /** Answer a pending question and resume the agent. */
  const answerQuestion = useCallback(
    async (answer: string) => {
      if (!pendingQuestion) return;

      const token = await getToken();
      if (!token) return;

      const pq = pendingQuestion;
      setPendingQuestion(null);
      setMessages((m) => [...m, { role: 'user', content: answer }]);
      setThinking(true);
      setToolActivity([]);

      // Inject the answer as the tool result for ask_user, then resume
      const resumeHistory: ApiMessage[] = [
        ...(pq.savedApiHistory as ApiMessage[]),
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: pq.toolUseId,
              content: answer,
            },
          ],
        },
      ];

      try {
        const finalHistory = await runAgentLoop(resumeHistory, sessionGoal, token);
        setApiHistory(finalHistory);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingQuestion, sessionGoal, projects, items],
  );

  /** Trigger a proactive check-in (called when user opens the panel with an active session). */
  const checkIn = useCallback(
    async () => {
      if (!sessionGoal || thinking) return;

      const token = await getToken();
      if (!token) return;

      setThinking(true);
      setToolActivity([]);

      const prompt = `The user has just reopened the planning panel. Briefly summarize where we left off in the session goal "${sessionGoal}", check if there's anything urgent or blocked on the board, and tell the user what to do next. Be concise.`;

      const currentHistory: ApiMessage[] = [
        ...apiHistory,
        { role: 'user', content: prompt },
      ];

      try {
        const finalHistory = await runAgentLoop(currentHistory, sessionGoal, token);
        setApiHistory(finalHistory);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${msg}` }]);
      } finally {
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionGoal, thinking, apiHistory, projects, items],
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setApiHistory([]);
    setSessionGoal('');
    setSessionNotes('');
    setPendingQuestion(null);
    setToolActivity([]);
  }, []);

  return {
    messages,
    sessionGoal,
    sessionNotes,
    pendingQuestion,
    thinking,
    toolActivity,
    sendMessage,
    startSession,
    answerQuestion,
    checkIn,
    clearSession,
  };
}
