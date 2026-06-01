---
name: design-taste
description: Dislikes "AI-generated" UI aesthetics — heavy rounded corners, decorative gradients, mono/typewriter fonts. Prefers restrained dark dashboard styling.
metadata:
  type: feedback
---

Strong visual preferences for own products:

- **Corner radii:** small. Cards ~6–10px, containers ~12px max. Anything bigger reads as "AI slop".
- **No decorative gradients** — no radial overlays on body backgrounds, no mesh gradients, no gradient avatars. Solid fills.
- **No monospace / typewriter fonts in product UI** — even for IDs, timestamps, metadata. Use a single modern sans-serif throughout. Geist Sans confirmed as a good default.
- **No grain/noise textures** unless extremely subtle and serving a purpose.
- **Reference aesthetic:** restrained enterprise dashboard look (he pointed to a "Fleet overview" screenshot — dark theme, subtle corners, no decoration, calm typography, small refined details).

When given preview-1 (Linear-style dark), preview-2 (Notion-style warm/cream with tinted column backgrounds), and preview-3 (mesh glassmorphism), he picked **preview-2's column-tinted layout + preview-1's dark palette** as the synthesis. Avoid all-cream/warm palettes; avoid glass/mesh effects.

**Why:** explicit feedback — "look very AI", "not typewriter font", "Stop using so rounded corners".

**How to apply:** When building UI for this user, default to dark + restrained + sans-only. Tinted column/section backgrounds are fine when they aid information density. Avoid the visual tropes above without being explicitly told.

Related: [[planningapp-project]], [[user-role]]
