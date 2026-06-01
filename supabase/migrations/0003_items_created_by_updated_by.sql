-- Track who created and last-updated each item. Nullable so the existing
-- rows don't fail; new rows are populated by the app's createItem /
-- updateItem store actions. FK to profiles so deleting a profile nulls
-- these out (we don't want item history to disappear with the user).
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS items_created_by_idx ON public.items (created_by);
CREATE INDEX IF NOT EXISTS items_updated_by_idx ON public.items (updated_by);
