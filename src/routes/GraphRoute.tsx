import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import type { Item, Priority, Status } from '@/lib/types';
import { ArrowLeft } from '@/components/icons';

/* ─── colours ─────────────────────────────────────────────────────────────── */

const STATUS_FILL: Record<Status, string> = {
  active:   'rgba(106,165,125,0.18)',
  blocked:  'rgba(198,110,107,0.18)',
  waiting:  'rgba(199,147,72,0.18)',
  backlog:  'rgba(90,90,100,0.18)',
  resolved: 'rgba(58,58,64,0.12)',
};
const STATUS_STROKE: Record<Status, string> = {
  active:   '#6aa57d',
  blocked:  '#c66e6b',
  waiting:  '#c79348',
  backlog:  '#5a5a5d',
  resolved: '#3a3a3d',
};
const PRIORITY_R: Record<NonNullable<Priority> | 'none', number> = {
  p0: 38, p1: 33, p2: 28, p3: 24, none: 24,
};

/* ─── simulation ───────────────────────────────────────────────────────────── */

interface SimNode {
  id: string;
  item: Item;
  x: number; y: number;
  vx: number; vy: number;
  pinned?: boolean;
}

interface SimEdge { source: string; target: string; }

function tick(nodes: SimNode[], edges: SimEdge[], w: number, h: number) {
  const cx = w / 2, cy = h / 2;

  // repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + 0.01;
      const d = Math.sqrt(d2);
      const f = 9000 / d2;
      const fx = f * dx / d, fy = f * dy / d;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  // spring along edges
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const e of edges) {
    const s = byId.get(e.source), t = byId.get(e.target);
    if (!s || !t) continue;
    const dx = t.x - s.x, dy = t.y - s.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ideal = 200;
    const f = (d - ideal) * 0.035;
    s.vx += f * dx / d; s.vy += f * dy / d;
    t.vx -= f * dx / d; t.vy -= f * dy / d;
  }

  // centre gravity
  for (const n of nodes) {
    n.vx += (cx - n.x) * 0.004;
    n.vy += (cy - n.y) * 0.004;
  }

  // integrate + damp
  let maxV = 0;
  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= 0.82; n.vy *= 0.82;
    n.x = Math.max(60, Math.min(w - 60, n.x + n.vx));
    n.y = Math.max(60, Math.min(h - 60, n.y + n.vy));
    maxV = Math.max(maxV, Math.abs(n.vx), Math.abs(n.vy));
  }
  return maxV;
}

/* ─── curved edge path ─────────────────────────────────────────────────────── */

function edgePath(
  sx: number, sy: number,
  tx: number, ty: number,
  sr: number, tr: number,
): string {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  // shorten ends so arrow sits at node border
  const x1 = sx + (dx / d) * sr;
  const y1 = sy + (dy / d) * sr;
  const x2 = tx - (dx / d) * (tr + 8); // leave room for arrowhead
  const y2 = ty - (dy / d) * (tr + 8);
  // slight curve — perpendicular offset
  const mx = (x1 + x2) / 2 - dy * 0.12;
  const my = (y1 + y2) / 2 + dx * 0.12;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

/* ─── component ────────────────────────────────────────────────────────────── */

export default function GraphRoute() {
  const navigate = useNavigate();
  const allItems   = useStore((s) => s.items);
  const projects   = useStore((s) => s.projects);

  const svgRef     = useRef<SVGSVGElement>(null);
  const frameRef   = useRef<number | null>(null);
  const nodesRef   = useRef<SimNode[]>([]);

  const [positions, setPositions]       = useState<Map<string, { x: number; y: number }>>(new Map());
  const [hoveredId, setHoveredId]       = useState<string | null>(null);
  const [draggingId, setDraggingId]     = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [hideResolved, setHideResolved] = useState(true);
  const [dims, setDims]                 = useState({ w: 1200, h: 700 });

  // Observe SVG size
  useEffect(() => {
    if (!svgRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0) setDims({ w: width, h: height });
    });
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, []);

  const visibleItems = useMemo(() => {
    let items = allItems.filter((i) => !hideResolved || i.status !== 'resolved');
    if (filterProject !== 'all') items = items.filter((i) => i.projectId === filterProject);
    return items;
  }, [allItems, hideResolved, filterProject]);

  const edges = useMemo<SimEdge[]>(() => {
    const visIds = new Set(visibleItems.map((i) => i.id));
    const result: SimEdge[] = [];
    for (const item of visibleItems) {
      for (const depId of item.dependsOn) {
        if (visIds.has(depId)) {
          result.push({ source: depId, target: item.id }); // arrow: prereq → dependent
        }
      }
    }
    return result;
  }, [visibleItems]);

  // (Re-)initialise simulation whenever item set changes
  useEffect(() => {
    if (dims.w === 0) return;
    const { w, h } = dims;
    const angle = (2 * Math.PI) / Math.max(visibleItems.length, 1);
    const r0 = Math.min(w, h) * 0.32;

    nodesRef.current = visibleItems.map((item, i) => {
      const existing = nodesRef.current.find((n) => n.id === item.id);
      return existing
        ? { ...existing, item }
        : {
            id: item.id,
            item,
            x: w / 2 + r0 * Math.cos(i * angle),
            y: h / 2 + r0 * Math.sin(i * angle),
            vx: 0, vy: 0,
          };
    });

    // Warm-up ticks before first paint
    for (let t = 0; t < 120; t++) {
      if (tick(nodesRef.current, edges, w, h) < 0.1) break;
    }
    flushPositions();
    startLoop();

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length, edges.length, dims.w, dims.h]);

  function flushPositions() {
    setPositions(new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }])));
  }

  function startLoop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    let stable = 0;
    function loop() {
      const maxV = tick(nodesRef.current, edges, dims.w, dims.h);
      flushPositions();
      if (maxV > 0.12) { stable = 0; } else { stable++; }
      if (stable < 30) frameRef.current = requestAnimationFrame(loop);
      else frameRef.current = null;
    }
    frameRef.current = requestAnimationFrame(loop);
  }

  /* drag */
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      setDraggingId(id);
      const node = nodesRef.current.find((n) => n.id === id);
      if (node) node.pinned = true;
    },
    [],
  );

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingId || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const node = nodesRef.current.find((n) => n.id === draggingId);
      if (!node) return;
      node.x = Math.max(60, Math.min(dims.w - 60, e.clientX - rect.left));
      node.y = Math.max(60, Math.min(dims.h - 60, e.clientY - rect.top));
      flushPositions();
      startLoop();
    }
    function onMouseUp() {
      if (!draggingId) return;
      const node = nodesRef.current.find((n) => n.id === draggingId);
      if (node) { node.pinned = false; node.vx = 0; node.vy = 0; }
      setDraggingId(null);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  const hovered = hoveredId ? allItems.find((i) => i.id === hoveredId) : null;
  const hoveredPos = hoveredId ? positions.get(hoveredId) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="h-12 flex items-center gap-3 px-4 shrink-0"
        style={{ borderBottom: '1px solid var(--line-1)' }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-[12.5px] px-1.5 py-1 rounded transition-colors"
          style={{ color: 'var(--ink-2)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Board
        </button>
        <span style={{ color: 'var(--ink-4)' }}>›</span>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--ink-1)' }}>
          Dependency graph
        </span>

        <div className="flex-1" />

        {/* Filters */}
        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <input
            type="checkbox"
            checked={hideResolved}
            onChange={(e) => setHideResolved(e.target.checked)}
            className="rounded"
          />
          Hide resolved
        </label>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-[12px] rounded-md px-2.5 py-1.5 outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line-2)',
            color: 'var(--ink-2)',
          }}
        >
          <option value="all">All projects</option>
          {projects.filter((p) => !p.deletedAt).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <span className="text-[11.5px]" style={{ color: 'var(--ink-4)' }}>
          {visibleItems.length} items · {edges.length} deps
        </span>
      </header>

      {/* Graph canvas */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="select-none"
          style={{ cursor: draggingId ? 'grabbing' : 'default' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                style={{ fill: 'var(--line-3)' }}
              />
            </marker>
            <marker
              id="arrowhead-hot"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" style={{ fill: 'var(--accent)' }} />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((e) => {
            const sp = positions.get(e.source);
            const tp = positions.get(e.target);
            if (!sp || !tp) return null;
            const sItem = allItems.find((i) => i.id === e.source);
            const tItem = allItems.find((i) => i.id === e.target);
            const sr = PRIORITY_R[sItem?.priority ?? 'none'];
            const tr = PRIORITY_R[tItem?.priority ?? 'none'];
            const isHot = hoveredId === e.source || hoveredId === e.target;
            return (
              <path
                key={`${e.source}-${e.target}`}
                d={edgePath(sp.x, sp.y, tp.x, tp.y, sr, tr)}
                fill="none"
                stroke={isHot ? 'var(--accent)' : 'var(--line-2)'}
                strokeWidth={isHot ? 1.5 : 1}
                markerEnd={isHot ? 'url(#arrowhead-hot)' : 'url(#arrowhead)'}
                opacity={isHot ? 1 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {visibleItems.map((item) => {
            const pos = positions.get(item.id);
            if (!pos) return null;
            const r  = PRIORITY_R[item.priority ?? 'none'];
            const isHovered = hoveredId === item.id;
            const isDragged = draggingId === item.id;
            const project   = projects.find((p) => p.id === item.projectId);

            return (
              <g
                key={item.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: isDragged ? 'grabbing' : 'grab' }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onMouseDown={(e) => handleNodeMouseDown(e, item.id)}
                onClick={() => { if (!isDragged) navigate(`/items/${item.id}`); }}
              >
                {/* Glow ring for hovered */}
                {isHovered && (
                  <circle
                    r={r + 8}
                    fill={STATUS_STROKE[item.status]}
                    opacity={0.12}
                    filter="url(#glow)"
                  />
                )}
                {/* Project colour outer ring */}
                {project && (
                  <circle
                    r={r + 4}
                    fill="none"
                    stroke={project.color}
                    strokeWidth={1.5}
                    opacity={0.35}
                  />
                )}
                {/* Main circle */}
                <circle
                  r={r}
                  fill={STATUS_FILL[item.status]}
                  stroke={STATUS_STROKE[item.status]}
                  strokeWidth={isHovered ? 2 : 1.5}
                />
                {/* Short ID */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={STATUS_STROKE[item.status]}
                  style={{ pointerEvents: 'none', letterSpacing: '-0.02em' }}
                >
                  {item.shortId}
                </text>
                {/* Priority badge */}
                {item.priority && (
                  <text
                    x={r - 6}
                    y={-(r - 6)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={8}
                    fontWeight={700}
                    fill={STATUS_STROKE[item.status]}
                    opacity={0.8}
                    style={{ pointerEvents: 'none' }}
                  >
                    {item.priority.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hovered && hoveredPos && (() => {
            const project = projects.find((p) => p.id === hovered.projectId);
            const px = Math.min(hoveredPos.x + 20, dims.w - 220);
            const py = Math.max(hoveredPos.y - 20, 10);
            const deps = hovered.dependsOn.length;
            const blocking = visibleItems.filter((i) => i.dependsOn.includes(hovered.id)).length;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={px} y={py}
                  width={210} height={deps > 0 || blocking > 0 ? 90 : 72}
                  rx={8}
                  fill="var(--surface-3)"
                  stroke="var(--line-2)"
                  strokeWidth={1}
                />
                <text x={px + 12} y={py + 18} fontSize={11} fontWeight={700}
                  fill="var(--ink-1)" style={{ letterSpacing: '-0.01em' }}>
                  {hovered.shortId}
                </text>
                <text x={px + 12} y={py + 33} fontSize={11} fill="var(--ink-2)">
                  {hovered.title.length > 26 ? hovered.title.slice(0, 26) + '…' : hovered.title}
                </text>
                <text x={px + 12} y={py + 48} fontSize={10} fill="var(--ink-4)">
                  {hovered.status} · {hovered.type}{hovered.priority ? ` · ${hovered.priority.toUpperCase()}` : ''}
                </text>
                {project && (
                  <text x={px + 12} y={py + 62} fontSize={10} fill="var(--ink-4)">
                    {project.name}
                  </text>
                )}
                {(deps > 0 || blocking > 0) && (
                  <text x={px + 12} y={py + 77} fontSize={10} fill="var(--ink-4)">
                    {deps > 0 ? `${deps} prereq${deps > 1 ? 's' : ''}` : ''}
                    {deps > 0 && blocking > 0 ? ' · ' : ''}
                    {blocking > 0 ? `blocking ${blocking}` : ''}
                  </text>
                )}
              </g>
            );
          })()}
        </svg>

        {/* Empty state */}
        {visibleItems.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ color: 'var(--ink-4)' }}>
            <p className="text-sm">No items to show.</p>
          </div>
        )}

        {/* Legend */}
        <div
          className="absolute bottom-4 left-4 flex flex-col gap-1.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--line-1)' }}
        >
          {(
            [
              ['active',   'Active'],
              ['blocked',  'Blocked'],
              ['waiting',  'Waiting'],
              ['backlog',  'Backlog'],
              ['resolved', 'Resolved'],
            ] as [Status, string][]
          ).map(([s, label]) => (
            <div key={s} className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink-3)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: STATUS_STROKE[s] }} />
              {label}
            </div>
          ))}
          <div className="border-t mt-1 pt-1.5" style={{ borderColor: 'var(--line-1)' }}>
            <p className="text-[10px]" style={{ color: 'var(--ink-4)' }}>
              Drag nodes · Click to open
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
