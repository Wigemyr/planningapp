---
name: planningapp-project
description: Personal Kanban planning tool, deployed on Vercel + Supabase. Solo founder use with 1-2 invited teammates.
metadata:
  type: project
---

Live, deployed, in use. Don't re-scaffold any of the v1 (localStorage) stuff — that was already migrated to Supabase as v2.

## Where things live

| | |
|---|---|
| **Repo** | `https://github.com/Wigemyr/planningapp` (private), branch `main` |
| **Local path (Sopra machine)** | `C:\Users\awigemyr\OneDrive - Sopra Steria\Documents\GitHub\planningapp` |
| **Production URL** | `https://planningapp-five.vercel.app` (also `…-anders-wigemyr-bakkens-projects.vercel.app`) |
| **Vercel team** | `team_lu9W7O8XWwpP31WOkAVsngYH` — "Anders Wigemyr Bakken's projects" |
| **Vercel project** | `prj_tk7DscbV3mOSxydj291ZdSES3wYp` — "planningapp", framework auto-detected as Vite |
| **Supabase org** | `soliiitrszppbnjoxqyv` — "Wiggy_Dev" (Free tier) |
| **Supabase project** | `rthbwrjrymubjmhpdvrx` — "planningapp", region `eu-central-1` (Frankfurt) |
| **Supabase URL** | `https://rthbwrjrymubjmhpdvrx.supabase.co` |
| **Supabase anon (publishable) key** | `sb_publishable_KQXLbQboDg0m0gLed66fwg_FbE-h3OU` (safe to commit; this is the public key) |

## Setup on a new machine

```bash
git clone https://github.com/Wigemyr/planningapp.git
cd planningapp
npm install
cat > .env.local <<'EOF'
VITE_SUPABASE_URL=https://rthbwrjrymubjmhpdvrx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_KQXLbQboDg0m0gLed66fwg_FbE-h3OU
EOF
npm run dev
```

Open <http://localhost:5173>, sign in with the same email used in production — Supabase auth carries across machines via magic link.

For MCP automation on the new machine: connect the Supabase and Vercel MCP servers in Claude Code. Tool names follow `mcp__<server-id>__<tool>` and the server IDs differ per machine.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind + @dnd-kit + zustand + react-router-dom 6, lucide-react icons
- **Backend:** Supabase Postgres (RLS), Supabase Auth (magic link), Supabase Realtime, Supabase Storage (private `attachments` bucket)
- **Hosting:** Vercel (Hobby, free, non-commercial) auto-deploys on push to `main`
- **State:** zustand store with async actions + optimistic updates. Realtime subscriptions reconcile remote changes into the store.

## Data model

- `profiles` (1:1 with auth.users) — name, initials, color, email
- `workspaces` — name, owner_id
- `workspace_members` — (workspace_id, user_id, role) — role is 'owner' | 'member'
- `workspace_invites` — (workspace_id, email, invited_by, consumed_at) — pending email-based invites
- `projects` — workspace-scoped, color + short_prefix
- `items` — workspace + project scoped, status + type + priority + labels + position
- `attachments` — file metadata; blobs in Storage at `{workspace_id}/{item_id}/{uuid}.ext`

RLS: every table gates by `is_workspace_member(workspace_id)` via SECURITY DEFINER helpers (avoid policy-recursion). Storage bucket gates by parsing workspace_id out of the path.

Realtime publishes: `items`, `projects`, `attachments`, `workspace_invites`.

## Statuses & types

- **Statuses (column-based Kanban):** Backlog, Active, Waiting, Blocked, Resolved, Discarded. **Do not** add Hold back — user removed it as redundant with Waiting.
- **Item types:** Bug, Feature, Task, Idea. Type is a first-class field (separate from labels and status). New bugs get position-min-1 so they land at the top of the column on creation; users can drag freely after.

## Features working today

- 6-column board with drag-and-drop (mouse, touch, keyboard via @dnd-kit)
- Item detail page (`/items/:id`) with explicit draft / Save / Discard
- Esc on detail with unsaved changes → 3-button overlay (Save & close / Go back / Discard)
- Image attachments: upload, drag-drop, **Ctrl+V paste** anywhere on detail page
- Image paste also works **inside the New Item dialog** (blobs stage with thumbnails, upload after Create)
- Magic-link auth (`/`) with `AuthGate`
- Invite-only system: signup is open but a non-first user with no invite lands on `PendingInviteRoute`
- Settings page (`/settings`) for **owners**: invite by email, revoke pending invites, remove members
- Realtime sync between teammates (item moves, edits, attachments propagate within ~1s)
- Custom Select component for in-dialog dropdowns (native select clips inside modals on some Win/Edge combos)
- Project create (`+` in sidebar opens NewProjectDialog: name, auto-prefix, color)

## Deferred (don't rebuild these — confirm with user first)

| | |
|---|---|
| **Invite-link flow** (`/join/{token}`) | User asked about it. Email-invite already works; would be additive. Plan: workspace_invite_links table with token, RPC `redeem_invite_token`, /join route. |
| **Project rename / delete UI** | Backend has `deleteProject`; no UI hover-menu or rename yet. |
| **Workspace switcher** | UI placeholder in sidebar (purple "A" + name) is inert. Store supports multi-workspace. |
| **Search / Filter / Sort / Group** | Removed inert UI items from topbar in last round. Re-add when implementing. |
| **List view** | Toggle was removed; only board view exists. |
| **Comments + @mentions** | User explicitly deferred. Big feature. |
| **`tsbuildinfo`** | Gitignored — don't commit. |

## Recent decisions (chronological, latest first)

1. **Round 5 (2026-05-27):** Replaced native `<select>` in NewItemDialog with custom Select component because Edge/Chrome on Windows renders native select menus as a 1px-wide sliver when the select is inside a fixed-position modal. Added image paste to NewItemDialog (stage blobs → upload after createItem). Lightened theme by ~3 steps on the dark scale. Killed inert top-bar buttons (Filter/Sort/Group/Share/More/List toggle) and inert sidebar links (Search/My items/Inbox/Recently added/Stale).

2. **Round 4:** Invite system. Bootstrap had a 403 bug: `.insert().select().single()` triggers RETURNING, which re-evaluates `workspaces_select` policy — and the user wasn't a member yet. Fixed by adding `owner_id = auth.uid()` to that policy. Added workspace_invites table + claim_invites/invite_member/revoke_invite/remove_member RPCs + is_first_user RPC. Bootstrap now: claim_invites → if no workspaces and is_first_user → auto-create; else show PendingInviteRoute.

3. **Round 3:** Supabase migration. Created project, applied 0001_init.sql, hardened function search_paths and grant scopes. Wired the app to Supabase: async store with optimistic updates, AuthGate, magic-link LoginRoute, Realtime subscriptions, Storage for attachments with signed URLs.

4. **Round 2:** Esc-with-unsaved-changes overlay on item detail. Draft pattern (everything stages, explicit Save).

5. **Round 1:** Initial scaffold with localStorage persistence. Type field (Bug visible). DnD. Image paste in detail view.

## How to invite a teammate (current flow)

The owner goes to **`/settings`** → enters their email → clicks **Invite**.
- If teammate already has an account → they're added as a member immediately
- If not → an invite row is created. When they sign in for the first time, `handle_new_user` trigger auto-claims the invite. If they were already signed up before being invited, `bootstrap` calls `claim_invites` on next sign-in.

Owner can revoke pending invites and remove members from the same page.

## Things to be careful of when extending

- Storing images in Storage uses signed URLs (expire after 24h). Detail view refreshes them on mount via `refreshAttachmentUrls`.
- Don't auto-create workspaces for signed-in users unless `is_first_user()` returns true. Otherwise rogue signups would each get their own workspace on the user's Supabase quota.
- Workspace bootstrap order matters: insert workspace, then insert workspace_members (self as owner), then `seed_default_projects`. The wm_insert RLS policy allows self-insert as owner exactly for this bootstrap moment.
- Custom `Select` component renders its menu in a fixed-position div with `z-[60]` — above modals (which use `z-50`). Don't downgrade.

Related: [[user-role]], [[design-taste]]
