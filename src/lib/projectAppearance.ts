import type { ComponentType, SVGProps } from 'react';
import {
  Folder,
  Code2,
  Book,
  Laptop,
  Layers,
  Briefcase,
  Rocket,
  Beaker,
  Palette,
  Sparkles,
  Zap,
  Bug,
  Flag,
  Star,
  Database,
  Target,
} from '@/components/icons';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/** Registry of icons a project can use. Order here drives the picker grid. */
export const PROJECT_ICONS: { slug: string; label: string; Icon: IconComponent }[] = [
  { slug: 'folder',    label: 'Folder',    Icon: Folder },
  { slug: 'code',      label: 'Code',      Icon: Code2 },
  { slug: 'book',      label: 'Notes',     Icon: Book },
  { slug: 'laptop',    label: 'Computer',  Icon: Laptop },
  { slug: 'layers',    label: 'Layers',    Icon: Layers },
  { slug: 'briefcase', label: 'Work',      Icon: Briefcase },
  { slug: 'rocket',    label: 'Launch',    Icon: Rocket },
  { slug: 'beaker',    label: 'Experiment', Icon: Beaker },
  { slug: 'palette',   label: 'Design',    Icon: Palette },
  { slug: 'sparkles',  label: 'Sparkles',  Icon: Sparkles },
  { slug: 'zap',       label: 'Bolt',      Icon: Zap },
  { slug: 'bug',       label: 'Bugs',      Icon: Bug },
  { slug: 'flag',      label: 'Flag',      Icon: Flag },
  { slug: 'star',      label: 'Star',      Icon: Star },
  { slug: 'database',  label: 'Data',      Icon: Database },
  { slug: 'target',    label: 'Target',    Icon: Target },
];

const ICON_BY_SLUG = new Map(PROJECT_ICONS.map((i) => [i.slug, i.Icon]));

/** Resolve an icon slug to its component. Unknown slugs fall back to Folder
 * so older rows without a recognised value still render something sensible. */
export function getProjectIcon(slug: string | null | undefined): IconComponent {
  if (!slug) return Folder;
  return ICON_BY_SLUG.get(slug) ?? Folder;
}

/** Curated swatches that work against the dark warm-neutral background.
 * 12 picks gives a 4×3 grid that still feels intentional, not a generic
 * color picker. */
export const PROJECT_COLORS = [
  '#6b87b8', // dusk blue
  '#7aa18d', // sage
  '#bda88a', // tan
  '#c79348', // amber
  '#c66e6b', // brick
  '#a872c0', // muted purple
  '#5fa3a8', // teal
  '#d28e60', // copper
  '#7170ff', // accent indigo
  '#8a8f99', // slate grey
  '#b97e9d', // dusty rose
  '#9aae65', // olive
];
