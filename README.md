# Planning

A personal Kanban planning tool — built so a solo founder can capture bugs, ideas, and features fast, and share the workspace with one or two teammates in real time. Drag cards across columns, paste screenshots straight in (Greenshot-friendly), assign work to people, and never lose a thought again.

Dark, restrained, no telemetry, no AI slop. Built with Vite + React + TypeScript + Tailwind + @dnd-kit + Supabase.

## Features

- 6-column Kanban: **Backlog → Active → Waiting → Blocked → Resolved → Discarded**
- Drag-and-drop between columns (keyboard accessible — Tab to a card, Space to grab, arrows, Space to drop)
- **Bug** type pins to the top of every column on creation; drag freely afterward
- Image attachments via **upload, drag-and-drop, or Ctrl+V paste** (works with Greenshot)
- Editable title + description with explicit **Save / Discard / Esc → unsaved-changes overlay**
- Workspaces and per-workspace **Projects** for splitting multiple products
- **Real-time sync** — changes from one teammate appear in everyone else's board within a second
- **Magic-link login** (no passwords), invite teammates by email via one SQL line
- Keyboard shortcut: **C** for new item, **⌘S** to save, **Esc** to close editor

## Setup

### 1. Create a Supabase project

1. Go to <https://supabase.com>, sign up, and create a new project (free tier is fine).
2. In your project, open **SQL Editor → New query**.
3. Open `supabase/migrations/0001_init.sql` from this repo, paste the whole file into the SQL editor, and click **Run**. This creates the schema, RLS policies, storage bucket, and helper functions.
4. Open **Authentication → URL Configuration** and:
   - Set **Site URL** to your production URL (e.g. `https://planningapp-yourname.vercel.app`)
   - Under **Redirect URLs**, also add `http://localhost:5173` (so local dev works)
5. Open **Authentication → Providers → Email** and confirm it's enabled. (Magic link is on by default.)
6. Open **Project Settings → API** and grab:
   - `Project URL` → this becomes `VITE_SUPABASE_URL`
   - `anon` `public` key → this becomes `VITE_SUPABASE_ANON_KEY`

### 2. Configure environment variables

#### Local development

```bash
cp .env.example .env.local
# edit .env.local and paste your URL and anon key
npm install
npm run dev
```

Open <http://localhost:5173>.

#### Vercel deployment

In your Vercel project → **Settings → Environment Variables**, add:

| Name                       | Value                                     |
|----------------------------|-------------------------------------------|
| `VITE_SUPABASE_URL`        | `https://<your-project-ref>.supabase.co`  |
| `VITE_SUPABASE_ANON_KEY`   | Your anon public key                      |

Redeploy. Done.

### 3. First sign-in

1. Open the app. Enter your email. Click **Send magic link**.
2. Click the link in your email — you'll be signed in and the app will auto-create a personal workspace seeded with three default projects.
3. From here it's just yours.

## Inviting a teammate

For one or two people, the lightest possible flow:

1. Ask your teammate to open your deployed URL and sign in with their email (they'll go through the magic link too). They'll see their own empty workspace afterward.
2. In the Supabase SQL Editor, find your workspace's id:
   ```sql
   select id, name from workspaces where owner_id = auth.uid();
   ```
   (Or just look in the **Table Editor → workspaces**.)
3. Run the invite helper as your authenticated user. Easiest path: in the Supabase dashboard, open **Database → Functions**, find `add_member_by_email`, click **Run**, and pass the workspace id and your teammate's email. Or via SQL:
   ```sql
   select add_member_by_email('<your-workspace-id>', 'teammate@example.com');
   ```
4. Your teammate refreshes the app and now sees your workspace. Changes sync live.

Removing a member is a simple `delete` from `workspace_members`.

## How it works

- **Auth & data live in Supabase.** RLS policies enforce that only workspace members can read or write that workspace's items.
- **Realtime** is wired through Supabase's `postgres_changes` channels — when one user moves a card or edits a description, others receive a Postgres replication event and apply it locally.
- **Optimistic UI** — your own edits apply locally immediately; the round-trip to Supabase happens in the background. If it fails, the change rolls back and you see an error banner.
- **Image attachments** upload to a private Supabase Storage bucket. The bucket is path-scoped to `{workspace_id}/{item_id}/{uuid}.png` so the same RLS check works for storage objects.

## Project structure

```
supabase/
└── migrations/
    └── 0001_init.sql        # one-shot schema + RLS + storage policies

src/
├── main.tsx                 # entry
├── App.tsx                  # AuthGate → Shell → Routes
├── index.css                # Tailwind + design tokens
├── env.d.ts                 # Vite env var types
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── types.ts             # Item, Project, User, ...
│   ├── constants.ts         # status & type configs, tints
│   └── format.ts            # date / id helpers
├── store/
│   ├── useStore.ts          # async CRUD + bootstrap + realtime
│   └── useUi.ts             # dialog open/close
├── components/
│   ├── AuthGate.tsx         # session probe + load
│   ├── Shell.tsx            # sidebar + main + global shortcuts
│   ├── Sidebar.tsx          # workspaces, projects, user menu
│   ├── Board.tsx            # DndContext
│   ├── BoardColumn.tsx      # droppable + sortable
│   ├── ItemCard.tsx
│   ├── NewItemDialog.tsx
│   ├── Avatar.tsx
│   └── icons.tsx
└── routes/
    ├── LoginRoute.tsx       # magic-link email form
    ├── BoardRoute.tsx       # /
    └── ItemRoute.tsx        # /items/:id (with unsaved-changes overlay)
```

## Costs

| Service     | Tier      | Cost  | Limits we're nowhere near                                       |
|-------------|-----------|-------|-----------------------------------------------------------------|
| Vercel      | Hobby     | Free  | Non-commercial / personal projects                              |
| Supabase    | Free      | Free  | 500 MB Postgres, 1 GB Storage, 50,000 monthly auth users, 200 concurrent realtime connections |
| GitHub      | Personal  | Free  | Source hosting                                                  |
| **Total**   |           | **$0**|                                                                 |

Heads up: Supabase free projects pause after **7 days of zero activity**. First request after pause takes ~5 seconds to wake. For a tool 2-3 of you use daily, you'll never hit this.

## Troubleshooting

### "Missing Supabase env vars" on login screen
The app couldn't find `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Locally → check `.env.local`. On Vercel → check Project Settings → Environment Variables, then redeploy.

### Magic link goes to the wrong URL after click
In Supabase → Authentication → URL Configuration, make sure your production URL is set as **Site URL** and `http://localhost:5173` is in **Redirect URLs**.

### "row level security policy violation" in the console
Either the migration didn't run fully, or the helper function `is_workspace_member` isn't installed. Re-run `0001_init.sql` end-to-end in the SQL editor.

### Real-time updates aren't arriving
Check **Database → Replication** in Supabase — `items`, `projects`, and `attachments` should all be in the `supabase_realtime` publication. Re-running the migration is idempotent and will fix this.

## Roadmap

- **Comments + @mentions** — would slot naturally into the existing item detail page
- **Member management UI** — replace the SQL invite with a proper page
- **List view** — toggle exists, view itself not implemented
- **Search & filter** — bones in place in the top filter bar
- **Workspace switcher** — currently picks the first workspace; the store supports more
