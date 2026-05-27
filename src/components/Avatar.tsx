import type { User } from '@/lib/types';

export function Avatar({
  user,
  size = 22,
  className = '',
  faded = false,
}: {
  user?: User;
  size?: number;
  className?: string;
  faded?: boolean;
}) {
  if (!user) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-line-2 text-ink-muted font-semibold shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.42) }}
        aria-label="Unassigned"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.42),
        background: user.color,
        opacity: faded ? 0.6 : 1,
      }}
      title={user.name}
      aria-label={user.name}
    >
      {user.initials}
    </span>
  );
}
