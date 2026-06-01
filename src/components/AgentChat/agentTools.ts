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
      'Get the full board state including items, priorities, types, labels, and dependency relationships. Always call this first before making any decisions. Includes which items are blocked by unresolved dependencies.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional: filter to a specific project ID.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_item_details',
    description:
      'Get full details for a specific item: description, labels, dependencies, and comments. Use this to deeply understand an item before making decisions about it.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The item ID (uuid)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_item',
    description:
      "Update an item's priority, status, title, description, or labels. Use this for single item changes.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The item ID (uuid)' },
        priority: {
          type: 'string',
          enum: ['p0', 'p1', 'p2', 'p3'],
          description: 'p0=critical blocker, p1=high/urgent, p2=medium/soon, p3=low/nice-to-have',
        },
        status: {
          type: 'string',
          enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'],
        },
        title: { type: 'string' },
        description: { type: 'string' },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Replace the full labels array. Common labels: api, frontend, backend, auth, db, infra, ux, billing.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'bulk_update_items',
    description:
      'Update multiple items at once. Use this to efficiently reprioritize or reorganize the board in a single pass rather than calling update_item repeatedly.',
    input_schema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              priority: { type: 'string', enum: ['p0', 'p1', 'p2', 'p3'] },
              status: { type: 'string', enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'] },
              labels: { type: 'array', items: { type: 'string' } },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['id'],
          },
        },
      },
      required: ['updates'],
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
        status: { type: 'string', enum: ['backlog', 'active', 'waiting', 'blocked', 'resolved'] },
        priority: { type: 'string', enum: ['p0', 'p1', 'p2', 'p3'] },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'project_id', 'type'],
    },
  },
  {
    name: 'add_dependency',
    description:
      'Mark that an item depends on another item — it cannot logically start until the dependency is resolved. Use this to model real technical dependencies (e.g. "implement auth" depends on "set up user table"). The agent should automatically move blocked items to the "blocked" status when their dependencies are unresolved.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'The item that has the prerequisite (the dependent)',
        },
        depends_on_id: {
          type: 'string',
          description: 'The item that must be resolved first (the prerequisite)',
        },
      },
      required: ['item_id', 'depends_on_id'],
    },
  },
  {
    name: 'remove_dependency',
    description: 'Remove a dependency relationship between two items.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        depends_on_id: { type: 'string' },
      },
      required: ['item_id', 'depends_on_id'],
    },
  },
  {
    name: 'add_comment',
    description:
      'Add a planning note or comment to an item. Use this to leave your reasoning, next steps, or architect notes directly on the task.',
    input_schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['item_id', 'body'],
    },
  },
  {
    name: 'ask_user',
    description:
      'Pause work and ask the user a specific question you cannot answer yourself. Use this ONLY when you genuinely need the user\'s input — for ambiguous business decisions, missing context, or architectural choices that depend on their goals. Do NOT ask for permission to make obvious technical decisions.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The specific question. Be direct — state what you already know and exactly what you need.',
        },
        context: {
          type: 'string',
          description: 'Brief context: why you need this answered (1-2 sentences).',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'update_session_notes',
    description: 'Save your working notes, analysis, or plan for this session so you can resume after answering questions.',
    input_schema: {
      type: 'object',
      properties: {
        notes: { type: 'string' },
      },
      required: ['notes'],
    },
  },
  {
    name: 'get_session_notes',
    description: 'Retrieve the session notes you saved earlier.',
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

      // Build a map for quick short-id lookups
      const idToShortId = new Map(store.items.map((i) => [i.id, i.shortId]));

      const order: Status[] = ['active', 'blocked', 'waiting', 'backlog', 'resolved'];
      const byStatus: Record<string, typeof items> = {};
      for (const s of order) byStatus[s] = [];
      for (const item of items) {
        if (byStatus[item.status]) byStatus[item.status].push(item);
      }

      const lines: string[] = [`Board summary — ${items.length} total items`];

      for (const status of order) {
        const statusItems = byStatus[status];
        if (statusItems.length === 0) continue;
        lines.push(`\n### ${status.toUpperCase()} (${statusItems.length})`);
        for (const item of statusItems) {
          const project = projects.find((p) => p.id === item.projectId);
          const deps = item.dependsOn
            .map((d) => idToShortId.get(d) ?? d)
            .join(', ');
          const unresolvedDeps = item.dependsOn.filter((d) => {
            const dep = store.items.find((i) => i.id === d);
            return dep && dep.status !== 'resolved';
          });
          const blockedFlag = unresolvedDeps.length > 0 ? ' ⚠️ UNRESOLVED_DEPS' : '';
          const labelsStr = item.labels.length > 0 ? ` labels=[${item.labels.join(',')}]` : '';
          const depsStr = deps ? ` depends_on=[${deps}]` : '';
          lines.push(
            `- id=${item.id} [${item.shortId}] "${item.title}" type=${item.type} priority=${item.priority ?? 'none'} project=${project?.name ?? '?'}${labelsStr}${depsStr}${blockedFlag}`,
          );
        }
      }

      // Dependency health summary
      const allUnresolved = items.filter(
        (i) =>
          i.status !== 'resolved' &&
          i.dependsOn.some((d) => {
            const dep = store.items.find((x) => x.id === d);
            return dep && dep.status !== 'resolved';
          }),
      );
      if (allUnresolved.length > 0) {
        lines.push(
          `\n### DEPENDENCY ALERTS (${allUnresolved.length} items blocked by unresolved prerequisites)`,
        );
        for (const item of allUnresolved) {
          const blockers = item.dependsOn
            .map((d) => store.items.find((x) => x.id === d))
            .filter((d) => d && d.status !== 'resolved')
            .map((d) => `[${d!.shortId}] "${d!.title}"`)
            .join(', ');
          lines.push(`- [${item.shortId}] "${item.title}" is waiting for: ${blockers}`);
        }
      }

      return lines.join('\n');
    }

    case 'get_item_details': {
      const { id } = input as { id: string };
      const item = store.items.find((i) => i.id === id);
      if (!item) return `Item ${id} not found.`;
      const project = store.projects.find((p) => p.id === item.projectId);
      const comments = store.comments.filter((c) => c.itemId === id);
      const idToShortId = new Map(store.items.map((i) => [i.id, i.shortId]));

      const depLines = item.dependsOn.map((d) => {
        const dep = store.items.find((i) => i.id === d);
        return dep
          ? `  - [${dep.shortId}] "${dep.title}" (${dep.status})`
          : `  - ${idToShortId.get(d) ?? d} (not found)`;
      });

      // Items that depend on this one
      const dependents = store.items.filter((i) => i.dependsOn.includes(id));
      const dependentLines = dependents.map(
        (d) => `  - [${d.shortId}] "${d.title}" (${d.status})`,
      );

      const commentLines = comments.map((c) => {
        const raw = c.body.replace(/<[^>]+>/g, '').trim();
        return `  - ${raw.slice(0, 200)}`;
      });

      return [
        `[${item.shortId}] "${item.title}"`,
        `Status: ${item.status} | Type: ${item.type} | Priority: ${item.priority ?? 'none'}`,
        `Project: ${project?.name ?? '?'}`,
        `Labels: ${item.labels.join(', ') || 'none'}`,
        `Description:\n${item.description?.replace(/<[^>]+>/g, '').trim() || '(none)'}`,
        depLines.length > 0 ? `Depends on:\n${depLines.join('\n')}` : 'Dependencies: none',
        dependentLines.length > 0 ? `Depended on by:\n${dependentLines.join('\n')}` : 'No dependents',
        commentLines.length > 0 ? `Comments:\n${commentLines.join('\n')}` : 'No comments',
      ].join('\n');
    }

    case 'update_item': {
      const { id, ...patch } = input as {
        id: string;
        priority?: Priority;
        status?: Status;
        title?: string;
        description?: string;
        labels?: string[];
      };
      const item = store.items.find((i) => i.id === id);
      if (!item) return `Item ${id} not found.`;
      await store.updateItem(id, patch);
      const changes = Object.keys(patch)
        .map((k) => `${k}=${JSON.stringify((patch as Record<string, unknown>)[k])}`)
        .join(', ');
      return `Updated [${item.shortId}] "${item.title}": ${changes}`;
    }

    case 'bulk_update_items': {
      const { updates } = input as {
        updates: Array<{
          id: string;
          priority?: Priority;
          status?: Status;
          labels?: string[];
          title?: string;
          description?: string;
        }>;
      };
      const results: string[] = [];
      for (const { id, ...patch } of updates) {
        const item = store.items.find((i) => i.id === id);
        if (!item) { results.push(`${id}: not found`); continue; }
        try {
          await store.updateItem(id, patch);
          results.push(`[${item.shortId}] updated`);
        } catch (err) {
          results.push(`[${item.shortId}] error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return `Bulk update complete:\n${results.join('\n')}`;
    }

    case 'move_item': {
      const { id, status, index } = input as { id: string; status: Status; index: number };
      const item = store.items.find((i) => i.id === id);
      if (!item) return `Item ${id} not found.`;
      await store.moveItem(id, status, index);
      return `Moved [${item.shortId}] "${item.title}" → ${status}.`;
    }

    case 'create_item': {
      const { title, description, project_id, type, status, priority, labels } = input as {
        title: string;
        description?: string;
        project_id: string;
        type: ItemType;
        status?: Status;
        priority?: Priority;
        labels?: string[];
      };
      const item = await store.createItem({
        title,
        description,
        projectId: project_id,
        type,
        status,
        priority,
        labels,
      });
      return `Created [${item.shortId}] "${item.title}".`;
    }

    case 'add_dependency': {
      const { item_id, depends_on_id } = input as { item_id: string; depends_on_id: string };
      const item = store.items.find((i) => i.id === item_id);
      const dep = store.items.find((i) => i.id === depends_on_id);
      if (!item) return `Item ${item_id} not found.`;
      if (!dep) return `Dependency target ${depends_on_id} not found.`;
      if (item.dependsOn.includes(depends_on_id)) return `Dependency already exists.`;
      await store.addDependency(item_id, depends_on_id);
      return `[${item.shortId}] now depends on [${dep.shortId}] "${dep.title}".`;
    }

    case 'remove_dependency': {
      const { item_id, depends_on_id } = input as { item_id: string; depends_on_id: string };
      const item = store.items.find((i) => i.id === item_id);
      const dep = store.items.find((i) => i.id === depends_on_id);
      if (!item) return `Item ${item_id} not found.`;
      await store.removeDependency(item_id, depends_on_id);
      return `Removed dependency: [${item.shortId}] no longer depends on [${dep?.shortId ?? depends_on_id}].`;
    }

    case 'add_comment': {
      const { item_id, body } = input as { item_id: string; body: string };
      const item = store.items.find((i) => i.id === item_id);
      if (!item) return `Item ${item_id} not found.`;
      await store.addComment(item_id, body, []);
      return `Added comment to [${item.shortId}].`;
    }

    case 'update_session_notes': {
      context.onSessionNotesUpdate(input.notes as string);
      return 'Session notes saved.';
    }

    case 'get_session_notes': {
      return context.sessionNotes
        ? `Session notes:\n${context.sessionNotes}`
        : 'No session notes saved yet.';
    }

    case 'ask_user':
      return 'Question sent to user.';

    default:
      return `Unknown tool: ${name}`;
  }
}
