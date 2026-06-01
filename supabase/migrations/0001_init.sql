-- ============================================================================
-- Planning App — initial schema, RLS, triggers, storage policies
-- Run this once in the Supabase SQL editor for a fresh project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- profiles extends auth.users with the bits we display in the UI
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  name        text not null,
  initials    text not null,
  color       text not null default '#7170ff',
  created_at  timestamptz not null default now()
);

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  initials    text not null,
  owner_id    uuid references public.profiles(id) on delete restrict not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id      uuid references public.profiles(id)   on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  name          text not null,
  color         text not null default '#7170ff',
  short_prefix  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists projects_workspace_idx on public.projects (workspace_id);

create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references public.workspaces(id) on delete cascade not null,
  project_id    uuid references public.projects(id)   on delete cascade not null,
  short_id      text not null,
  title         text not null,
  description   text not null default '',
  status        text not null check (status in ('backlog','active','waiting','blocked','resolved','discarded')),
  type          text not null check (type   in ('bug','feature','task','idea')),
  priority      text          check (priority in ('p0','p1','p2','p3')),
  labels        text[] not null default array[]::text[],
  assignee_id   uuid references public.profiles(id) on delete set null,
  position      double precision not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  resolved_at   timestamptz,
  unique (workspace_id, short_id)
);
create index if not exists items_workspace_status_idx on public.items (workspace_id, status);
create index if not exists items_project_idx on public.items (project_id);

create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references public.items(id) on delete cascade not null,
  filename      text not null,
  storage_path  text not null,
  size_bytes    bigint not null,
  mime_type     text not null,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists attachments_item_idx on public.attachments (item_id);

-- ----------------------------------------------------------------------------
-- Auto-create profile when a user signs up via Supabase Auth
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_initials text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  v_initials := upper(substring(v_name from 1 for 2));
  insert into public.profiles (id, email, name, initials)
  values (new.id, new.email, v_name, v_initials)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at touch on items
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute procedure public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Helper for RLS: avoid recursive subqueries by using a SECURITY DEFINER fn
-- ----------------------------------------------------------------------------

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.items             enable row level security;
alter table public.attachments       enable row level security;

-- profiles — every authenticated user can read all profiles
-- (needed for assignee/avatar rendering across workspaces)
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- workspaces
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update to authenticated using (public.is_workspace_owner(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete to authenticated using (public.is_workspace_owner(id));

-- workspace_members
drop policy if exists wm_select on public.workspace_members;
create policy wm_select on public.workspace_members
  for select to authenticated using (
    user_id = auth.uid() or public.is_workspace_member(workspace_id)
  );

-- Allow self-insert when creating the workspace (you must be the new owner of
-- a workspace you also just created) OR if you're already an owner inviting.
drop policy if exists wm_insert on public.workspace_members;
create policy wm_insert on public.workspace_members
  for insert to authenticated with check (
    (user_id = auth.uid() and role = 'owner')
    or public.is_workspace_owner(workspace_id)
  );

drop policy if exists wm_delete on public.workspace_members;
create policy wm_delete on public.workspace_members
  for delete to authenticated using (
    user_id = auth.uid() or public.is_workspace_owner(workspace_id)
  );

-- projects
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- items
drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete to authenticated using (public.is_workspace_member(workspace_id));

-- attachments — check via parent item's workspace
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated using (
    exists (
      select 1 from public.items i
      where i.id = attachments.item_id
        and public.is_workspace_member(i.workspace_id)
    )
  );
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert to authenticated with check (
    exists (
      select 1 from public.items i
      where i.id = item_id
        and public.is_workspace_member(i.workspace_id)
    )
  );
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
  for delete to authenticated using (
    exists (
      select 1 from public.items i
      where i.id = attachments.item_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Realtime: publish the tables we want client subscriptions on
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    execute 'alter publication supabase_realtime add table public.items';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    execute 'alter publication supabase_realtime add table public.projects';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attachments'
  ) then
    execute 'alter publication supabase_realtime add table public.attachments';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Storage bucket + policies
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Path convention: <workspace_id>/<item_id>/<uuid>.<ext>

drop policy if exists attachments_storage_select on storage.objects;
create policy attachments_storage_select on storage.objects
  for select to authenticated using (
    bucket_id = 'attachments'
    and public.is_workspace_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists attachments_storage_insert on storage.objects;
create policy attachments_storage_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'attachments'
    and public.is_workspace_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists attachments_storage_delete on storage.objects;
create policy attachments_storage_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'attachments'
    and public.is_workspace_member((split_part(name, '/', 1))::uuid)
  );

-- ----------------------------------------------------------------------------
-- Helper RPCs
-- ----------------------------------------------------------------------------

-- Seed default projects when a workspace is created.
create or replace function public.seed_default_projects(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can seed projects';
  end if;
  insert into public.projects (workspace_id, name, color, short_prefix) values
    (p_workspace_id, 'Inbox',          '#7170ff', 'INB'),
    (p_workspace_id, 'Internal tools', '#06b6d4', 'INT'),
    (p_workspace_id, 'Marketing',      '#ec4899', 'MKT')
  on conflict do nothing;
end;
$$;

-- Add a teammate to your workspace by email. They must have signed up first.
create or replace function public.add_member_by_email(p_workspace_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only the workspace owner can add members';
  end if;

  select id into v_user_id from public.profiles where email = p_email;
  if v_user_id is null then
    raise exception 'No user signed up with %. Ask them to sign in once first, then re-run.', p_email;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_user_id, 'member')
  on conflict do nothing;
end;
$$;

-- ============================================================================
-- Done. Verify in Supabase dashboard:
--   - Auth → Providers: enable Email; turn on "Confirm email" if desired
--   - Auth → URL Configuration: set Site URL to your Vercel URL,
--     add http://localhost:5173 to additional redirect URLs for local dev
--   - Database → Replication: confirm items/projects/attachments are published
-- ============================================================================
