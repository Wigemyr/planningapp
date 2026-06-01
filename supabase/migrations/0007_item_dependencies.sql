CREATE TABLE IF NOT EXISTS item_dependencies (
  item_id       uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  depends_on_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  PRIMARY KEY (item_id, depends_on_id),
  CONSTRAINT no_self_dependency CHECK (item_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS item_dependencies_item_id_idx       ON item_dependencies (item_id);
CREATE INDEX IF NOT EXISTS item_dependencies_depends_on_id_idx ON item_dependencies (depends_on_id);

ALTER TABLE item_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can read dependencies"
  ON item_dependencies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM items i
      JOIN workspace_members wm ON wm.workspace_id = i.workspace_id
      WHERE i.id = item_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace members can manage dependencies"
  ON item_dependencies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM items i
      JOIN workspace_members wm ON wm.workspace_id = i.workspace_id
      WHERE i.id = item_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace members can delete dependencies"
  ON item_dependencies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM items i
      JOIN workspace_members wm ON wm.workspace_id = i.workspace_id
      WHERE i.id = item_id AND wm.user_id = auth.uid()
    )
  );
