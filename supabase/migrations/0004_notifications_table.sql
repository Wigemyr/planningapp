-- Notifications fanout: one row per (recipient, event). Populated by DB
-- triggers so the client can't forge "you were mentioned" entries, and so a
-- mention/assignment that happens while the recipient is offline still lands
-- in their bell when they sign in.

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  comment_id    uuid          REFERENCES public.comments(id) ON DELETE CASCADE,
  actor_id      uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind          text NOT NULL CHECK (kind IN ('assigned', 'mentioned', 'commented_on_assigned')),
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON public.notifications(recipient_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_item_idx      ON public.notifications(item_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Only the recipient ever sees their notifications.
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  USING (recipient_id = auth.uid());

-- No client-side INSERTs — triggers are the only writer (SECURITY DEFINER).
-- Omitting an INSERT policy means no client can write rows.

-- Recipient can mark as read or clear individual notifications.
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE
  USING (recipient_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Trigger 1: assignment changes on items
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_assignee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.updated_by, NEW.created_by);
BEGIN
  -- Skip if assignee didn't change, or if there's no new assignee, or if the
  -- actor is assigning themselves (no point notifying yourself).
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL AND v_actor = NEW.assignee_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, workspace_id, item_id, actor_id, kind)
  VALUES (NEW.assignee_id, NEW.workspace_id, NEW.id, v_actor, 'assigned');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS items_notify_assignee ON public.items;
CREATE TRIGGER items_notify_assignee
AFTER INSERT OR UPDATE OF assignee_id ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.notify_assignee_change();

-- ─────────────────────────────────────────────────────────────
-- Trigger 2: new comments → mentions + (commented_on_assigned)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_comment_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mention uuid;
  v_assignee uuid;
  v_mention_set uuid[] := COALESCE(NEW.mentions, ARRAY[]::uuid[]);
BEGIN
  -- 1) Mention notifications. Skip self-mentions.
  FOREACH v_mention IN ARRAY v_mention_set LOOP
    IF v_mention IS NOT NULL AND v_mention <> NEW.author_id THEN
      INSERT INTO public.notifications
        (recipient_id, workspace_id, item_id, comment_id, actor_id, kind)
      VALUES
        (v_mention, NEW.workspace_id, NEW.item_id, NEW.id, NEW.author_id, 'mentioned');
    END IF;
  END LOOP;

  -- 2) Item assignee gets a 'commented_on_assigned' notification, unless
  --    they're the author or were already mentioned (in which case the
  --    'mentioned' notification is enough).
  SELECT assignee_id INTO v_assignee FROM public.items WHERE id = NEW.item_id;
  IF v_assignee IS NOT NULL
     AND v_assignee <> NEW.author_id
     AND NOT (v_assignee = ANY(v_mention_set))
  THEN
    INSERT INTO public.notifications
      (recipient_id, workspace_id, item_id, comment_id, actor_id, kind)
    VALUES
      (v_assignee, NEW.workspace_id, NEW.item_id, NEW.id, NEW.author_id, 'commented_on_assigned');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_notify_recipients ON public.comments;
CREATE TRIGGER comments_notify_recipients
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_recipients();

-- Realtime: deliver inserts/updates so the bell badge updates live.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
