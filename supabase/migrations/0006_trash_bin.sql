-- Soft-delete columns on workspaces + projects. Hard delete still works as
-- "permanent delete" from the trash UI; everyday deletes become UPDATEs to
-- deleted_at so users can restore.
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.projects   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS workspaces_deleted_at_idx ON public.workspaces(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_deleted_at_idx   ON public.projects(deleted_at)   WHERE deleted_at IS NOT NULL;
