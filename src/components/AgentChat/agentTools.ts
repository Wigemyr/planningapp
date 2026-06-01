import type { ItemType, Priority, Status } from '@/lib/types';
import { useStore } from '@/store/useStore';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: object;
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_board_summary',
    description:
      'Get all items on the board grouped by status. Always call this before making planning decisions.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional: filter to a specific project ID. Omit for all projects.',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_item',
    description: "Update an item's priority, status, title, or description.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The item ID (uuid)' },
        priority: {
          type: 'string',
          enum: ['p0', 'p1', 'p2', 'p3'],
          description: 'p0=critical, p1=high, p2=medium, p3=low',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'],
        },
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'move_item',
    description: 'Move an item to a different status column at a specific position.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The item ID (uuid)' },
        status: {
          type: 'string',
          enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'],
        },
        index: {
          type: 'number',
          description: 'Position in the target column (0 = top)',
        },
      },
      required: ['id', 'status', 'index'],
    },
  },
  {
    name: 'create_item',
    description: 'Create a new item on the board.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        project_id: { type: 'string', description: 'The project ID (uuid)' },
        type: { type: 'string', enum: ['bug', 'feature', 'task', 'idea'] },
        status: {
          type: 'string',
          enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'],
        },
        priority: { type: 'string', enum: ['p0', 'p1', 'p2', 'p3'] },
      },
      required: ['title', 'project_id', 'type'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a planning note or comment to an item.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string', description: 'The item ID (uuid)' },
        body: { type: 'string', description: 'Plain text comment' },
      },
      required: ['item_id', 'body'],
    },
  },
  {
    name: 'ask_user',
    description:
      'Pause work and ask the user a question that you need answered before continuing. Use this when you hit a decision point, need clarification, or want to check in on something blocked. Be specific — state what you already know and exactly what you need.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask. Be direct and specific.',
        },
        context: {
          type: 'string',
          description:
            'Optional: brief context explaining why you need this answered (1-2 sentences).',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'update_session_notes',
    description:
      'Save your working notes, plan, or progress summary for the current session. These notes persist so you can reference them later.',
    input_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Your working notes, plan steps, or progress summary.',
        },
      },
      required: ['notes'],
    },
  },
  {
    name: 'get_session_notes',
    description: 'Retrieve the session notes you saved earlier in this work session.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

export type ToolInput = Record<string, unknown>;

export interface AgentContext {
  sessionNotes: string;
  onSessionNotesUpdate: (notes: string) => void;
}

export async function executeTool(
  name: string,
  input: ToolInput,
  context: AgentContext,
): Promise<string> {
  const store = useStore.getState();

  switch (name) {
    case 'get_board_summary': {
      const projectId = input.project_id as string | undefined;
      const items = projectId
        ? store.items.filter((i) => i.projectId === projectId)
        : store.items;
      const projects = store.projects;

      const order: Status[] = ['active', 'blocked', 'waiting', 'backlog', 'resolved'];
      const byStatus: Record<string, typeof items> = {};
      for (const s of order) byStatus[s] = [];
      for (const item of items) {
        if (byStatus[item.status]) byStatus[item.status].push(item);
      }

      const lines: string[] = [];
      for (const status of order) {
        const statusItems = byStatus[status];
        if (statusItems.length === 0) continue;
        lines.push(`\n## ${status.toUpperCase()} (${statusItems.length})`);
        for (const item of statusItems) {
          const project = projects.find((p) => p.id === item.projectId);
          lines.push(
            `- id=${item.id} [${item.shortId}] "${item.title}" type=${item.type} priority=${item.priority ?? 'none'} project=${project?.name ?? 'unknown'}`,
          );
        }
      }
      return lines.length > 0 ? lines.join('\n') : 'Board is empty.';
    }

    case 'update_item': {
      const { id, ...patch } = input as {
        id: string;
        priority?: Priority;
        status?: Status;
        title?: string;
        description?: string;
      };
      const item = store.items.find((i) => i.id === id);
      if (!item) return `Item ${id} not found.`;
      await store.updateItem(id, patch);
      return `Updated [${item.shortId}] "${item.title}".`;
    }

    case 'move_item': {
      const { id, status, index } = input as { id: string; status: Status; index: number };
      const item = store.items.find((i) => i.id === id);
      if (!item) return `Item ${id} not found.`;
      await store.moveItem(id, status, index);
      return `Moved [${item.shortId}] to ${status}.`;
    }

    case 'create_item': {
      const { title, description, project_id, type, status, priority } = input as {
        title: string;
        description?: string;
        project_id: string;
        type: ItemType;
        status?: Status;
        priority?: Priority;
      };
      const item = await store.createItem({
        title,
        description,
        projectId: project_id,
        type,
        status,
        priority,
      });
      return `Created [${item.shortId}] "${item.title}".`;
    }

    case 'add_comment': {
      const { item_id, body } = input as { item_id: string; body: string };
      const item = store.items.find((i) => i.id === item_id);
      if (!item) return `Item ${item_id} not found.`;
      await store.addComment(item_id, body, []);
      return `Added comment to [${item.shortId}].`;
    }

    case 'update_session_notes': {
      const { notes } = input as { notes: string };
      context.onSessionNotesUpdate(notes);
      return 'Session notes saved.';
    }

    case 'get_session_notes': {
      return context.sessionNotes
        ? `Session notes:\n${context.sessionNotes}`
        : 'No session notes saved yet.';
    }

    // ask_user is handled specially in useAgent — it should never reach here
    case 'ask_user':
      return 'Question sent to user.';

    default:
      return `Unknown tool: ${name}`;
  }
}
