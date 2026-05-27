-- Per-project icon. Stores a slug that maps to a Lucide icon on the client
-- (see PROJECT_ICONS in src/lib/projectAppearance.ts). NOT NULL with a 'folder'
-- default so the column is always usable; client falls back to 'folder' for
-- any unknown slug.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'folder';
