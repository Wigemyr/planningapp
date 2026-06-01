import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUi } from '@/store/useUi';
import {
  PROJECT_ICONS,
  PROJECT_COLORS,
  getProjectIcon,
} from '@/lib/projectAppearance';
import { Check, X } from './icons';

/**
 * Modal that lets the user pick an icon + color for the project whose id is
 * stored on `useUi.appearanceProjectId`. Mounting site is in Shell.
 *
 * Open via right-click → "Customize…" on a project row in the sidebar.
 */
export function ProjectAppearanceDialog() {
  const projectId = useUi((s) => s.appearanceProjectId);
  const close = useUi((s) => s.closeProjectAppearance);
  const project = useStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : null,
  );
  const updateProject = useStore((s) => s.updateProject);

  // Local draft so the user can preview their choice before committing.
  const [icon, setIcon] = useState<string>('folder');
  const [color, setColor] = useState<string>('#6b87b8');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Seed local state whenever the dialog opens on a new project.
  useEffect(() => {
    if (!project) return;
    setIcon(project.icon);
    setColor(project.color);
    setErrorMsg(null);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc to close.
  useEffect(() => {
    if (!projectId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [projectId, close]);

  if (!projectId || !project) return null;

  const dirty = icon !== project.icon || color !== project.color;
  const PreviewIcon = getProjectIcon(icon);

  async function save() {
    if (!project || !dirty) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateProject(project.id, { icon, color });
      close();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save appearance',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="proj-appearance-title"
        className="w-full max-w-[440px] bg-panel border border-line shadow-2xl shadow-black/50"
        style={{ borderRadius: 10 }}
      >
        {/* Header — live preview chip on the left so changes are obvious. */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line">
          <span
            className="inline-flex items-center justify-center rounded-md shrink-0"
            style={{
              width: 36,
              height: 36,
              background: `${color}1f`, // ~12% alpha tint of the swatch
              border: `1px solid ${color}3a`,
            }}
            aria-hidden="true"
          >
            <PreviewIcon
              className="w-4 h-4"
              style={{ color }}
              strokeWidth={1.75}
            />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="proj-appearance-title" className="text-[14px] font-semibold truncate">
              Customize {project.name}
            </h2>
            <p className="text-[11.5px] text-ink-muted">
              Icon and color appear in the sidebar and on item cards.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="p-1 rounded text-ink-subtle hover:text-ink-2 hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Icon grid */}
        <div className="px-5 pt-4">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle mb-2">
            Icon
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {PROJECT_ICONS.map(({ slug, label, Icon }) => {
              const selected = icon === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setIcon(slug)}
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  className="aspect-square rounded-md flex items-center justify-center transition-colors"
                  style={{
                    background: selected
                      ? `${color}24`
                      : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${selected ? color : 'transparent'}`,
                  }}
                >
                  <Icon
                    className="w-4 h-4"
                    style={{ color: selected ? color : 'var(--ink-2)' }}
                    strokeWidth={1.75}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Color swatches */}
        <div className="px-5 pt-4 pb-4">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-subtle mb-2">
            Color
          </div>
          <div className="grid grid-cols-12 gap-1.5">
            {PROJECT_COLORS.map((c) => {
              const selected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  aria-label={`Color ${c}`}
                  aria-pressed={selected}
                  className="aspect-square rounded-full flex items-center justify-center transition-transform"
                  style={{
                    background: c,
                    transform: selected ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: selected
                      ? '0 0 0 2px var(--bg), 0 0 0 3px var(--ink-2)'
                      : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  }}
                >
                  {selected && (
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="mx-5 mb-3 text-[12px] text-[#fca5a5] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.18)] rounded px-2.5 py-1.5">
            {errorMsg}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line"
          style={{
            background: 'rgba(0,0,0,0.18)',
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <button
            type="button"
            onClick={close}
            className="text-[12.5px] px-3 py-1.5 rounded text-ink-2 hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-accent hover:bg-accent-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
