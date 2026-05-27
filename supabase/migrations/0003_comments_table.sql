-- Comments / discussion thread under items.
--
-- One row per posted comment. `body` is HTML produced by RichTextEditor (the
-- same constrained whitelist used for item descriptions). `mentions` is the
-- set of profile ids the author @-mentioned at post time, used later to drive
-- in-app notifications.
--
-- RLS mirrors items: any workspace member can read; only members can post and
-- only as themselves; only the author can edit; the author OR the workspace
-- owner can delete.

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_item_id_idx     ON public.comments(item_id);
CREATE INDEX IF NOT EXISTS comments_workspace_id_idx ON public.comments(workspace_id);
CREATE INDEX IF NOT EXISTS comments_author_id_idx   ON public.comments(author_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON public.comments
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY comments_insert ON public.comments
  FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND author_id = auth.uid()
  );

CREATE POLICY comments_update ON public.comments
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY comments_delete ON public.comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR public.is_workspace_owner(workspace_id)
  );

-- Touch updated_at on every UPDATE so the UI can show an "· edited" tag.
CREATE OR REPLACE FUNCTION public.comments_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_touch_updated_at ON public.comments;
CREATE TRIGGER comments_touch_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.comments_touch_updated_at();

-- Realtime: expose the table on the supabase_realtime publication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
