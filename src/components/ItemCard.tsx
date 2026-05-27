import { useNavigate } from 'react-router-dom';
import type { Item, ItemType } from '@/lib/types';
import { STATUS_CONFIG, PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/constants';
import { useStore } from '@/store/useStore';
import { Avatar } from './Avatar';
import { Bug, Paperclip, Clock } from './icons';

/** Restrained, single-tone palette per item type (Slate Paper). Only Bug pops. */
const TYPE_PILL: Record<ItemType, { label: string; bg: string; color: string; border?: string }> = {
  bug:     { label: 'Bug',     bg: 'rgba(198,110,107,0.10)', color: 'var(--sem-danger)', border: 'rgba(198,110,107,0.20)' },
  feature: { label: 'Feature', bg: 'rgba(255,255,255,0.05)', color: 'var(--ink-2)' },
  task:    { label: 'Task',    bg: 'rgba(255,255,255,0.05)', color: 'var(--ink-3)' },
  idea:    { label: 'Idea',    bg: 'rgba(199,147,72,0.10)',  color: 'var(--sem-warn)' },
};

interface Props {
  item: Item;
  dragging?: boolean;
}

export function ItemCard({ item, dragging = false }: Props) {
  const navigate = useNavigate();
  const users = useStore((s) => s.users);
  const projects = useStore((s) => s.projects);
  const currentProjectId = useStore((s) => s.currentProjectId);

  const assignee = users.find((u) => u.id === item.assigneeId);
  const project = projects.find((p) => p.id === item.projectId);
  const statusCfg = STATUS_CONFIG[item.status];

  const cardBorder = statusCfg.cardBorder ?? undefined;
  const isBug = item.type === 'bug';
  const isResolved = item.status === 'resolved';

  return (
    <article
      onClick={(e) => {
        // ignore if a drag just happened (handled by listeners)
        e.stopPropagation();
        navigate(`/items/${item.id}`);
      }}
      className={`group cursor-pointer rounded-md border border-line bg-panel p-3 pb-2.5 transition-colors hover:bg-panel-2 hover:border-line-2 focus-within:bg-panel-2 ${
        dragging ? 'ring-1 ring-accent/40' : ''
      }`}
      style={{
        borderColor: cardBorder ?? undefined,
        borderRadius: 6,
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }}
      aria-label={`${item.shortId}: ${item.title}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {(() => {
          const t = TYPE_PILL[item.type];
          return (
            <span
              className="pill inline-flex items-center gap-[3px]"
              style={{
                background: t.bg,
                color: t.color,
                border: t.border ? `1px solid ${t.border}` : undefined,
                opacity: item.status === 'resolved' ? 0.7 : 1,
              }}
            >
              {isBug && <Bug className="w-2.5 h-2.5" strokeWidth={2.25} />}
              {t.label}
            </span>
          );
        })()}
        <span className="meta-text">{item.shortId}</span>
        {item.priority && (
          <span
            className="pill"
            style={{
              background: PRIORITY_COLOR[item.priority].bg,
              color: PRIORITY_COLOR[item.priority].color,
            }}
          >
            {PRIORITY_LABEL[item.priority]}
          </span>
        )}
        {item.labels.slice(0, 2).map((label) => (
          <span key={label} className="pill" style={labelStyle(label)}>
            {label}
          </span>
        ))}
      </div>

      <h3
        className={`text-[13.5px] font-medium leading-snug mb-1 ${
          statusCfg.strike ? 'line-through decoration-[#3a3e46] text-ink-muted' : ''
        }`}
      >
        {item.title}
      </h3>

      {item.description && !isResolved && (
        <p className="text-[12px] leading-snug text-ink-muted line-clamp-2">
          {item.description.replace(/[`*#_~]/g, '').replace(/\n+/g, ' ')}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-line">
        <Avatar user={assignee} size={20} faded={isResolved} />
        {/* Project chip — only shown in "All projects" view */}
        {currentProjectId === null && project && (
          <span className="text-[11px] text-ink-subtle truncate max-w-[120px]" title={project.name}>
            <span className="dot mr-1 align-middle" style={{ background: project.color, width: 6, height: 6 }} />
            {project.name}
          </span>
        )}
        <div className="flex-1" />
        {item.attachments.length > 0 && (
          <span className="text-[11px] flex items-center gap-1 text-ink-muted" title={`${item.attachments.length} attachment(s)`}>
            <Paperclip className="w-3 h-3" strokeWidth={1.75} />
            {item.attachments.length}
          </span>
        )}
        {item.status === 'waiting' && (
          <span
            className="pill"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}
          >
            <Clock className="w-2.5 h-2.5 mr-0.5" strokeWidth={2} />
            {waitingDays(item.updatedAt)}d
          </span>
        )}
      </div>
    </article>
  );
}

function waitingDays(iso: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function labelStyle(label: string): React.CSSProperties {
  // small palette by label name — keeps colors stable across renders
  const palette: Record<string, { bg: string; color: string }> = {
    billing:   { bg: 'rgba(245,158,11,0.10)', color: '#f59e0b' },
    api:       { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
    inbox:     { bg: 'rgba(113,112,255,0.12)', color: '#7170ff' },
    marketing: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899' },
    internal:  { bg: 'rgba(6,182,212,0.12)',  color: '#06b6d4' },
    support:   { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    idea:      { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  };
  const c = palette[label] ?? { bg: 'rgba(138,143,153,0.10)', color: '#8a8f99' };
  return { background: c.bg, color: c.color };
}
