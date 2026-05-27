-- Add a sort position to projects so the sidebar can reorder them.
-- Defaults to created_at-based sequencing so existing rows get a stable order.

alter table public.projects
  add column if not exists position double precision not null default 0;

-- Backfill: order existing projects by created_at within each workspace.
with ranked as (
  select id,
         row_number() over (partition by workspace_id order by created_at) as rn
  from public.projects
)
update public.projects p
   set position = r.rn
  from ranked r
 where r.id = p.id
   and p.position = 0;

create index if not exists projects_position_idx on public.projects (workspace_id, position);
