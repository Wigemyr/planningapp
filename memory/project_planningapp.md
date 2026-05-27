---
name: planningapp-project
description: Personal Kanban-style planning tool for capturing SaaS ideas/bugs/features. Solo user, but multi-user-ready.
metadata:
  type: project
---

Lives at `C:\Users\awigemyr\OneDrive - Sopra Steria\Documents\GitHub\planningapp`. Started 2026-05-27 from an empty initial commit.

**Statuses (column-based Kanban):** Backlog, Active, Waiting, Blocked, Resolved, Discarded. Hold was considered but removed — redundant with Waiting.

**Item types (separate from status):** Bug, Feature, Task, Idea. Type is a first-class field, not a tag. Bugs get a red badge prominently displayed on cards and **auto-sort to the top of every column** because the user wants them visually impossible to miss. Other types stay implicit in v1 — only Bug renders a badge until the user asks for more.

**Required features:**
- Drag-and-drop between status columns
- Item detail view with title, description, image attachments, comment thread with @mentions
- Image attachments via file upload AND clipboard paste (Windows + Greenshot workflow — must "just work")
- Both Kanban board and List view, toggle in header
- Top-level Workspaces/Projects (user runs multiple SaaS products in parallel)
- Card view shows attachment **count** only (paperclip icon + number) — no thumbnails on the card

**Recommended stack (not yet scaffolded):** Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase (auth, Postgres, realtime, storage) hosted on Cloudflare Pages or Vercel free tier. User has not committed yet — confirm before scaffolding.

**Design direction:** dark theme, restrained dashboard styling, tinted column backgrounds per status (subtle dark+hue tints), small corner radii, Geist Sans only (no mono). See [[design-taste]] for the full rationale.

Design mockups are at `design-previews/`:
- `preview-1-linear.html` — chosen direction (after synthesis with #2's layout)
- `preview-2-notion.html` — alternate (warm/cream, rejected)
- `preview-3-glass.html` — alternate (glassmorphism, rejected)

**Why this project:** User constantly captures features/bugs/ideas while developing SaaS products but has no tool — building this so he stops losing ideas in scratch files.

**How to apply:** Prioritize fast capture UX (keyboard shortcuts, paste-image-Ctrl-V, low-friction new item). Hosting must stay free.

Related: [[user-role]], [[design-taste]]
