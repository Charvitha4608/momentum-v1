# Canvas Theme Audit

**Purpose.** Inventory of every color in the app that is coupled to the current dark canvas, ahead of the user-selectable canvas-theme feature (preset themes applied via a data attribute on `<html>`). The future palette is undecided — dark tints, light backgrounds, anything — so this audit flags *coupling*, not "dark-mode bugs".

**Read this first — the two token layers.** `app/globals.css` holds two overlapping token systems, both dark:

1. **Legacy shadcn layer** (`:root` lines 71–98): `--background: #18172d`, `--card: #28264B`, `--primary: #959ec9`, `--secondary: #4e5174`, `--muted: #312e59`, `--muted-foreground: #9aa1cc`, `--destructive: #a40033`, `--border`/`--input` (color-mix of `#e8eae7` at 10%/14% over transparent), `--ring: #959ec9`, plus the 6 `--calendar-*` heatmap colors.
2. **Redesign layer** (lines 100–140): `--bg: #08080c`, `--bg-grad` (purple/coral radial glows over `#08080c`), `--surface-1/2/3` (**white at 2.5%/4.5%/7% alpha**), `--line`/`--line-2` (**white at 7%/12% alpha**), `--tx/--tx-dim/--tx-faint`, `--accent-1/2` + `--accent-soft/line/grad`, `--coral(-soft)`, `--green(-soft)`, `--amber`, `--surface-overlay: rgba(22,22,30,.92)`, `--scrim: rgba(4,4,8,.66)`.

The comment at `globals.css:101` ("Not yet applied to any screen") is **stale** — the redesign tokens are live across the shell, cards, dialogs, calendar, and dashboard. Both layers must become theme-aware. Also structural: `layout.tsx:34` hardcodes `class="dark"` on `<html>` (with `@custom-variant dark` at `globals.css:5`), so every `dark:` utility branch (in `ui/button.tsx`, `ui/input.tsx`) is permanently active today; a theme attribute will interact with this.

Legend for the **Source** column: **var** = flows through a CSS variable in `globals.css` (theme can swap it centrally); **hardcoded** = literal hex/rgba or a raw Tailwind palette utility (needs migration first); **module** = scoped local palette in `auth-form.module.css`; **db** = color value stored per-row in the database.

---

## Category 1 — SITS-ON-CANVAS

Elements rendered directly on the page background, colored relative to it.

| Location | Element / purpose | Current value or class | Source |
|---|---|---|---|
| `components/app-shell.tsx:31` | **The canvas itself** — app frame | `bg-app-canvas` → `--bg-grad` (purple/coral radial glows fading into `#08080c`) | var (gradient endpoint hardcoded inside the var) |
| `app/layout.tsx:34` + `globals.css:147-149` | `<html>`/`<body>` fallback canvas | `bg-background` → `#18172d` (note: **differs** from the shell's `#08080c`) | var |
| `app/layout.tsx:23` | Mobile browser chrome (`themeColor`) | `'#18172d'` literal in metadata | **hardcoded** (can't read CSS vars; must be set per theme in JS) |
| `components/sidebar.tsx:51` | Sidebar surface + right hairline | `bg-white/[0.012] border-line` | **hardcoded** (white-alpha) + var |
| `components/sidebar.tsx:82` | **Active nav item pill** | `border-brand-line bg-brand-soft text-white` + `before:bg-brand` marker bar | var, except `text-white` **hardcoded** |
| `components/sidebar.tsx:83` | Inactive nav + hover state | `text-muted-foreground/90 hover:bg-muted/20 hover:text-muted-foreground` | var (alpha-modified) |
| `components/sidebar.tsx:108,122` | Sign-out / collapse hover | `hover:bg-secondary/50 hover:text-foreground` | var |
| `components/sidebar.tsx:58`, `components/app-shell.tsx:41` | Brand logo mark (on sidebar/canvas) | `bg-primary text-primary-foreground` | var |
| `components/notification-bell.tsx:47-48` | Bell (sidebar variant): active / hover | active `bg-brand-soft text-white`; hover `bg-secondary/50` | var + `text-white` **hardcoded** |
| `components/notification-bell.tsx:74` | Bell (mobile bar variant) hover | `hover:bg-secondary/60` | var |
| `components/bottom-tab-bar.tsx:12` | Mobile tab bar surface + top divider | `border-t border-border bg-background/95 backdrop-blur` | var (also Cat 2) |
| `components/bottom-tab-bar.tsx:23-24` | Active tab pill / inactive tab | `bg-muted/50 text-foreground` / `text-muted-foreground/70` | var |
| `components/app-shell.tsx:38` | Mobile header page-level divider | `border-b border-border` | var |
| `components/focus/focus-dock.tsx:90` | Focus dock (sits in sidebar, effectively on canvas) | `border-line bg-surface-2` | var |
| `components/calendar-view-switcher.tsx:22,28` | Calendar tab strip on canvas; active tab pill | track `border-line bg-surface-1`; pressed `border-brand-line bg-brand-soft text-white` | var + `text-white` **hardcoded** |
| `app/calendar/page.tsx:117,125` | Month prev/next buttons on canvas | `text-muted-foreground hover:bg-secondary/60 hover:text-foreground` | var |
| `components/calendar-week-view.tsx:390,398` | Week prev/next buttons on canvas | same pattern as above | var |
| `app/page.tsx:47` | AI digest strip on canvas | `border-border bg-surface-2 text-muted-foreground` | var |
| `app/page.tsx:68` + `globals.css:178-193` | AI Planner glow card on canvas | `.ai-glow-card`: purple-alpha gradient wash + radial glow + `--accent-line` border | **hardcoded** rgba inside the utility class |
| `components/sidebar.tsx:95` | Sidebar footer divider | `border-t border-line` | var |
| `components/history-calendar.tsx:206` | Empty calendar day cells (padding cells) | transparent `aspect-square` divs — inherit canvas | n/a (verify against new canvases) |

**Current-date ring** (calendar) is at `history-calendar.tsx:219,228` — classified under Cat 2/4 below because it is a glow.

---

## Category 2 — BLENDS-WITH-CANVAS  ⚠ highest priority

Semi-transparent or blurred surfaces where the canvas shows through. **The dominant pattern in this app**: nearly every surface is a *white-alpha wash* and nearly every tint is a *color-alpha wash*, so the perceived color is arithmetic over the dark canvas. Over a light canvas, white-alpha surfaces become invisible (or read inverted) and dark scrims/glows flip in meaning.

### 2a. Token-level translucents (fix once in `globals.css`, but every theme must re-derive them)

| Token (`app/globals.css`) | Value | Where the canvas shows through |
|---|---|---|
| `--bg-grad` (l.106) | radial `rgba(124,108,255,.1)` + `rgba(255,107,94,.05)` → `#08080c` | the canvas itself — gradient endpoints assume dark |
| `--surface-1/2/3` (l.109-111) | `rgba(255,255,255, .025/.045/.07)` | **every Card**, day cells, chips, stat tiles, hover states |
| `--line` / `--line-2` (l.113-114) | `rgba(255,255,255, .07/.12)` | all hairlines/borders in the redesign system |
| `--border` / `--input` (l.87-88) | `color-mix(#e8eae7 10%/14%, transparent)` | legacy hairlines, input borders |
| `--accent-soft` / `--accent-line` (l.122-123) | `rgba(139,124,255, .14/.3)` | active nav pill, today cell, current-week row, AI card border |
| `--coral-soft` / `--green-soft` (l.127,129) | `rgba(255,110,96,.13)` / `rgba(70,211,154,.13)` | streak stat badge, (green reserved) |
| `--surface-overlay` (l.135) | `rgba(22,22,30,.92)` | dialog/popover panels — near-opaque **dark** |
| `--scrim` (l.136) | `rgba(4,4,8,.66)` | modal backdrop — dark scrim |

### 2b. Blur / scrim / gradient surfaces

| Location | Element | Value or class | Source |
|---|---|---|---|
| `components/ui/dialog.tsx:27` | Modal backdrop | `bg-scrim backdrop-blur-[6px]` | var |
| `components/ui/dialog.tsx:34` | Dialog panel + drop shadow | `bg-surface-overlay` + `shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]` | var + **hardcoded** shadow |
| `components/ui/popover.tsx:21` | Popover panel | `bg-surface-overlay border-line-2 shadow-xl` | var |
| `components/command-bar.tsx:191` | Command-bar backdrop | `bg-background/70 backdrop-blur-sm` | var (alpha) |
| `components/command-bar.tsx:202` | Command-bar panel shadow | `shadow-2xl shadow-background/60` | var (alpha) — shadow tinted with the canvas color |
| `components/bottom-tab-bar.tsx:12` | Glassy mobile tab bar | `bg-background/95 backdrop-blur` | var (alpha) |
| `components/sidebar.tsx:51` | Sidebar glass wash | `bg-white/[0.012]` | **hardcoded** |
| `globals.css:181,191` | `.ai-glow-card` wash + corner glow | `linear-gradient(...rgba(139,124,255,.1→.02))`, `radial-gradient(...rgba(139,124,255,.28)→transparent)` | **hardcoded** |
| `globals.css:205` | `.elevate-hover` shadow | `color-mix(in oklch, #18172d 70%, transparent)` — shadow tinted to match the dark canvas | **hardcoded** |
| `components/ui/button.tsx:12`, `app/page.tsx:72,94` | Brand button purple glow shadow | `shadow-[0_6px_18px_-6px_rgba(109,93,255,0.6)]` (and `0_4px_14px_-3px` variant) | **hardcoded** |
| `components/history-calendar.tsx:228` | **Today-cell glow ring** | `boxShadow: 0 0 0 1px var(--accent-1), 0 0 16px -4px rgba(139,124,255,0.7)` | var + **hardcoded** glow |
| `components/calendar-week-view.tsx:17-23,99-101` | Pillar badge — runtime `hexToRgba(pillarColor, .15)` fill + `.3` border under full-strength pillar text | computed rgba from **db** hex | **hardcoded** alphas |
| `components/focus/focus-heatmap-cards.tsx:22-25,56` | Focus heatmap cells — pillar color at **opacity 0.08–1.0** blending with the card/canvas beneath | `style={{backgroundColor: color, opacity}}` | **db** color, opacity encodes intensity |

### 2c. Alpha-modified semantic utilities (canvas/card shows through each one)

≈**150 instances across ≈35 files** follow a small set of repeated recipes. Representative locations (full list reproducible with `grep -rE "(bg|text|border|ring|shadow)-[a-z-]+/[0-9]"`):

| Recipe | Purpose | Example locations |
|---|---|---|
| `bg-primary/5..20` (+ `border-primary/25..40`, `ring-primary/30..40`) | selected chips, "you" rows, AI accents, unread rows | `leaderboard.tsx:89`, `weekly-leaderboard.tsx:27`, `challenges-card.tsx:136`, `notification-list.tsx:90`, `ai-planner.tsx:146,198,211,242,423,444`, `ai-badge.tsx:15`, `target-list.tsx:593,651`, `availability-quick-edit.tsx:62`, `command-bar.tsx:48,206,262,344,477,505,539,855`, `profile-form.tsx:167`, `calendar-week-view.tsx:151,158` |
| `bg-secondary/30..80` | hover fills, chips, stat tiles | `sidebar.tsx:108,122`, `sign-out-button.tsx:17`, `calendar-week-view.tsx:274,283,354,390,398`, `calendar-pillars-view.tsx:92-103`, `weekly-review-list.tsx:43`, `neglected-pillars-card.tsx:22`, `friend-manager.tsx:80,110,148`, `pillar-manager.tsx:186,214`, `notification-bell.tsx:48,74`, `notification-list.tsx:88`, `toggle-group.tsx:13`, `button.tsx:16`, `command-bar.tsx:234,513,632,767`, `app/calendar/page.tsx:117,125`, `pillar-checklist.tsx:165` |
| `bg-muted/20..50` | nav hover, active tab, card footer, ghost hover | `sidebar.tsx:83`, `bottom-tab-bar.tsx:23`, `ui/card.tsx:87`, `ui/button.tsx:18` |
| `bg-destructive/10..30`, `ring-destructive/20..40` | destructive buttons/hovers | `ui/button.tsx:20`, `ai-planner.tsx:382`, `command-bar.tsx:521` |
| `bg-input/30..80` | outline-button + input fills, disabled fills | `ui/button.tsx:14`, `ui/input.tsx:12`, `availability-settings.tsx:19,38` |
| `text-muted-foreground/40..90`, `text-destructive/70`, `text-primary/80` | faint text tiers, ghost icons | `sidebar.tsx:83`, `bottom-tab-bar.tsx:24`, `calendar-week-view.tsx:78,80,89,141,277,347`, `target-list.tsx:517,583`, `pillar-picker.tsx:139,155,209`, `command-bar.tsx:214..850` (9×), `history-calendar.tsx:338`, many dialogs' placeholders |
| `border-muted-foreground/40`, `border-foreground/40`, `ring-foreground/10` | unchecked checkbox/circles, planner day ring | `ui/checkbox.tsx:12`, `calendar-week-view.tsx:80`, `pillar-checklist.tsx:175`, `ai-planner.tsx:243` |
| `ring-ring/50`, `outline-ring/50` | focus rings — **applied globally to `*`** | `globals.css:145`, `ui/button.tsx:7`, `ui/input.tsx:12`, `ui/checkbox.tsx:12` |

### 2d. Auth screens (scoped module — separate palette, same problem)

`components/auth-form.module.css` — entire screen is layered translucents over its own dark canvas: brand-panel radial glows + dark gradient (l.76-78), noise grain with `mix-blend-mode: soft-light` (l.88-95), violet halo `rgba(139,124,255,.2→0)` + `blur(16px)` (l.151-157), black elliptical shadow `rgba(0,0,0,.55)` (l.170), card inset white highlight + black drop shadow (l.243-244), white-alpha borders (l.13-14), coral-alpha chip (l.222-223), `--accent-soft` focus glows (l.316,348,403,486). All **module-hardcoded**.

---

## Category 3 — SURFACES TUNED-AGAINST-CANVAS

Opaque (or effectively-opaque) backgrounds that only look right over the current dark canvas.

| Location | Element | Value or class | Source |
|---|---|---|---|
| `components/ui/card.tsx:15` | Card surface + border (every card in the app) | `border-line bg-surface-1` | var (translucent — see Cat 2a) |
| `components/ui/card.tsx:87` | Card footer | `border-t bg-muted/50` | var |
| `components/ui/dialog.tsx:34`, `ui/popover.tsx:21` | Dialog/popover panels | `bg-surface-overlay border-line-2` — near-opaque **dark** rgba | var |
| `components/ui/progress.tsx:20,24` | **Progress bar empty track / fill** (dashboard, leaderboard profile, reflection cards) | track `bg-muted`, fill `bg-primary` | var |
| `components/today-progress-card.tsx:36` | Daily ring **empty track** (SVG stroke) | `stroke="var(--line-2)"` | var |
| `components/today-progress-card.tsx:65` | Daily thin bar empty track | `bg-surface-3` | var |
| `components/weekly-score-card.tsx:57,59` | **Weekly score bar** empty track / fill | `bg-surface-3` / `bg-brand-gradient` | var |
| `components/focus/focus-dock.tsx:55` | Focus ring empty track (SVG) | `stroke="currentColor"` + `class="text-line"` | var |
| `components/calendar-week-view.tsx:304-307` | Pillar distribution track / fill | `bg-secondary` / `bg-primary` | var |
| `components/calendar-pillars-view.tsx:83-86` | Pillar completion track / fill | `bg-secondary` / `bg-primary` | var |
| `components/ui/input.tsx:12` | Input: border, transparent fill, disabled fills | `border-input bg-transparent dark:bg-input/30 disabled:bg-input/50` + `dark:disabled:bg-input/80` | var |
| ~15 inline inputs | `bg-transparent border-line` text fields (rely on canvas/card behind) | e.g. `recurring-task-dialog.tsx:103,161`, `goal-form-dialog.tsx:111,152,166,179`, `challenge-form-dialog.tsx:74,131`, `pillar-picker.tsx:155`, `pillar-manager.tsx:41`, `command-bar.tsx:214,622,681,850`, `history-calendar.tsx:338`, `pillar-checklist.tsx:84`, `target-list.tsx:583` | var |
| `components/ui/toggle-group.tsx:13,28` | Toggle track / pressed pill | `bg-secondary/50` / `data-[pressed]:bg-card` | var |
| `components/ui/button.tsx:12-21` | All 6 button variants (incl. `outline` `bg-background`, `secondary`, `ghost`, `destructive` washes) | see Cat 2c/4 | var except default-variant glow+`text-white` |
| `components/command-bar.tsx:202,256` | Command panel; inline edit input | `bg-card border-border`; `bg-surface-2 focus:ring-primary` | var |
| `bg-surface-2 / bg-surface-3` chips & tiles (≈30 sites) | stat tiles, emoji/pill chips, hover states | `leaderboard.tsx:89,124,135-156,168,187`, `profile-form.tsx:50,60,67,74,81,99,136,153,166-167`, `target-list.tsx:485,614,722,745`, `target-details-editor.tsx:180,203`, `backlog-card.tsx:224`, `focus-dock.tsx:133,144,161`, `history-calendar.tsx:180,188,217,281`, `ai-planner.tsx:162,244`, `manage-recurring-dialog.tsx` etc. | var |
| `bg-secondary/40` stat tiles | week summary, pillar stats | `calendar-week-view.tsx:274,283`, `calendar-pillars-view.tsx:92,96,103`, `weekly-review-list.tsx:43`, `neglected-pillars-card.tsx:22`, `friend-manager.tsx:80,110,148` | var |
| `components/pillar-manager.tsx:67`, `pillar-picker.tsx:181` | Swatch selection ring offset — **offset color hardwired to the surface it sits on** | `ring-offset-card` / `ring-offset-surface-overlay` | var |
| `components/leaderboard.tsx:96` (+`challenges-card.tsx:142`, `weekly-leaderboard.tsx:33`) | #1 rank badge / unranked badge | `bg-primary text-primary-foreground` / `bg-muted text-muted-foreground` | var |
| Scrollbars | **Not styled anywhere**; no `color-scheme` property is set either → browser default scrollbars/form-controls follow the *OS* scheme, not the app theme | — | **gap** (must set `color-scheme` per theme) |
| Skeleton loaders | none exist (no `animate-pulse`/skeleton components found); loading states are text ("Loading…") | — | n/a |
| Disabled states | opacity-based throughout (`disabled:opacity-40/50`) — theme-neutral, survives any canvas | many files | ok |
| `components/auth-form.module.css:9-12,235-245,295-307,367-382,428-438` | Auth canvas `#0a0b11`, panel `#0d0e16`, input/notice/checkbox surfaces `#14151f`/`#181a26` | opaque hex darks | **module** |

---

## Category 4 — FOREGROUND TUNED-AGAINST-CANVAS

Text, icons, strokes chosen for legibility on dark.

| Location | Element | Value or class | Source |
|---|---|---|---|
| `globals.css:72,82` | Body text / muted text (app-wide) | `--foreground: #e8eae7`, `--muted-foreground: #9aa1cc` — near-white/light-lavender | var |
| `globals.css:116-118` | Redesign text tiers | `--tx #ececef`, `--tx-dim #9b9bac`, `--tx-faint #62626f` (only `--tx-faint` consumed today — heatmap "no targets" dot) | var |
| **`text-white` on brand-soft pills** — `sidebar.tsx:82`, `notification-bell.tsx:47`, `calendar-view-switcher.tsx:22` | Active nav/tab text sits on `--accent-soft` = purple at **14% alpha** → effective contrast comes from the dark canvas | `text-white` | **hardcoded** ⚠ breaks hardest on light canvas |
| `text-white` on brand gradient — `ui/button.tsx:12`, `app/page.tsx:72,94` | Default button / AI planner CTA text | `text-white` over `--accent-grad` (opaque purple) | **hardcoded** but safe on any canvas (gradient is opaque); still should be a token (`text-on-brand`) |
| `globals.css:78` | `--primary-foreground: #18172d` — text on primary **is the canvas color** | used at ~25 sites (`bg-primary text-primary-foreground` buttons: dialogs, pickers, focus dock, backlog, target list, rank badges, brand marks) | var, but its *value* is coupled to the canvas |
| `text-primary` accents (≈60 sites) | Section-header icons, points values, "(you)", links, add-affordances | e.g. `leaderboard.tsx:57,107,111,136,152`, `weekly-score-card.tsx:36`, `calendar-week-view.tsx:76,181,275,285,288`, `history-calendar.tsx:294,320`, `stat/balance/effort/breakdown/backlog/challenges/notification/goal cards`, `command-bar.tsx` (10+) | var (`#959ec9` — a *light* lavender: on a light canvas this fails contrast) |
| `text-destructive` | **Streak flame** (`profile-form.tsx:68`, `leaderboard.tsx:141,156`), overdue header (`calendar-week-view.tsx:332`), errors, delete hovers (≈15 sites) | `--destructive #a40033` — a *dark* red: barely legible on the dark canvas already; on dark themes it depends on surrounding lightness | var |
| `components/stat-card.tsx:22` | Streak/points badge icon+bg | `bg-coral-soft text-coral` / `bg-brand-soft text-brand` | var |
| `lib/completion.ts:27-29` | Ahead/on-time/late status text (used in `history-calendar.tsx:294,301`, `backlog-card.tsx:113`, `command-bar.tsx:769`, `target-list.tsx`) | `text-indigo-400`, `text-emerald-500`, `text-amber-500` | **hardcoded** Tailwind palette |
| `components/calendar-pillars-view.tsx:12-15` | Pillar status ladder | `text-primary` / `text-blue-400` / `text-yellow-500` / `text-destructive` | half var / half **hardcoded** |
| `components/target-list.tsx:352` | Estimate delta | `text-amber-500` / `text-emerald-500` | **hardcoded** |
| `components/history-calendar.tsx:292`, `components/help-assistant.tsx:85` | "Completed late" clock, docs icon | `text-amber-500` | **hardcoded** |
| `components/history-calendar.tsx:28-35,44-47,223,240` | **Heatmap dot scale + legend** | `var(--tx-faint)` → `var(--coral)` → `var(--amber)` → `var(--accent-1)` → `var(--green)`; planned `var(--color-calendar-planned)` (`#6d6acb`) | var (chosen for dark; `--amber #f5b84b` and `--green #46d39a` lose contrast on light) |
| `globals.css:93-98` | Legacy `--calendar-*` scale (only `--calendar-planned` still consumed) | `#e8eae7/#a40033/#959ec9/#4e5174/#28264B/#6d6acb` | var (mostly dead — verify & prune) |
| `components/today-progress-card.tsx:51-52` | Daily ring gradient stroke (SVG stops) | `#9a8cff`, `#6d5dff` | **hardcoded** (duplicates `--accent-grad`) |
| `components/focus/focus-dock.tsx:61` | Focus ring stroke = pillar color | `stroke={focusSession.pillarColor}` | **db** |
| Pillar accent colors (`lib/pillar-icons.ts:36-48`, default `lib/auth.ts:14` `#959EC9`) | Pillar dots (7+ sites), badge text over own 15%-alpha fill (`calendar-week-view.tsx:99-101`), heatmap cells, timer icon (`target-list.tsx:470`), goal progress fill + left border (`pillar-goal-card.tsx:85,139`) | 11 fixed hexes, chosen against dark (`#eab308` amber, `#84cc16` lime pop on dark but blind on light; `#5d0018` maroon/`#57534e` gray vanish on dark already) | **hardcoded + db** — values are persisted per pillar row |
| `globals.css:89,145`, `ui/*.tsx` | Focus rings — global `outline-ring/50`, `ring-ring/50` | `--ring: #959ec9` (light lavender) | var |
| `components/notification-bell.tsx:33` | **Unread dot** — destructive fill with a canvas-colored halo | `bg-destructive ring-2 ring-background` — `ring-background` literally paints the canvas color | var (value coupled) |
| `components/notification-list.tsx:90,98` | Unread row tint; icon chip | `bg-primary/10`; `bg-secondary text-muted-foreground` | var |
| `components/ui/checkbox.tsx:12` | Unchecked border / checked fill | `border-muted-foreground/40` / `data-[checked]:bg-primary text-primary-foreground` | var |
| Selection highlight | `::selection` not styled — browser default over dark surfaces | — | **gap** |
| `components/login-characters.tsx:89,107,124,210,224,238,252` | Auth mascots: pupils/mouth `#18172d`, sclera `#e8eae7`, bodies `#3d3f63/#8b8fc2/#b6b0ea/#edeef4` (hand-lightened variants of the dark-theme tokens) | inline styles + arbitrary classes | **hardcoded** |
| `components/auth-form.module.css:15-18,452` | Auth text `#f4f5fa`/`#9a9eb2`/`#6b6f82`, error `#ff8a8a` (a *light* red, readable only on dark) | module tokens | **module** |
| `public/icon.svg` (+ `icon-light/dark-32x32.png`, `apple-icon.png`) | Favicon inverts via `prefers-color-scheme` — follows the **OS**, not the app theme | white/black swap | asset |

---

## Category 5 — HARDCODED VALUES (master list)

Every literal color / raw Tailwind palette utility outside `globals.css` token definitions. (Items also appear in their behavioral category above; this is the migration checklist.)

**Hex / rgb literals in components & lib:**

| # | Location | Value | Purpose |
|---|---|---|---|
| 1 | `app/layout.tsx:23` | `#18172d` | `themeColor` viewport metadata |
| 2 | `components/today-progress-card.tsx:51-52` | `#9a8cff`, `#6d5dff` | SVG ring gradient stops |
| 3 | `components/history-calendar.tsx:228` | `rgba(139,124,255,0.7)` | today-cell glow |
| 4 | `components/ui/dialog.tsx:34` | `rgba(0,0,0,0.8)` | dialog drop shadow |
| 5 | `components/ui/button.tsx:12` | `rgba(109,93,255,0.6)` | brand button glow |
| 6 | `app/page.tsx:72,94` | `rgba(109,93,255,0.6)` ×2 | AI planner icon/CTA glows |
| 7 | `components/login-characters.tsx:89,124` | `#18172d` ×2 | pupils, mouth |
| 8 | `components/login-characters.tsx:107` | `#e8eae7` | eye sclera |
| 9 | `components/login-characters.tsx:210,224,238,252` | `#3d3f63`, `#8b8fc2`, `#b6b0ea`, `#edeef4` | character bodies |
| 10 | `lib/pillar-icons.ts:37-47` | 11 hexes (`#06b6d4`…`#57534e`) | pillar palette — **persisted to db per pillar** |
| 11 | `lib/auth.ts:14` | `#959EC9` | default pillar color written at signup |
| 12 | `components/calendar-week-view.tsx:17-23` | runtime `rgba(r,g,b,α)` from db hex | pillar badge tint |
| 13 | `globals.css:106-107,124,181,191,205` | gradient endpoints `#08080c`, rgba glows, `#18172d` shadow mix | inside token/utility definitions — themes must override the whole var, not just a hex |

**Raw Tailwind palette utilities:**

| # | Location | Class | Purpose |
|---|---|---|---|
| 14 | `lib/completion.ts:27-29` | `text-indigo-400`, `text-emerald-500`, `text-amber-500` | ahead/on-time/late (radiates to 4+ consumer components) |
| 15 | `components/calendar-pillars-view.tsx:13-14` | `text-blue-400`, `text-yellow-500` | pillar status |
| 16 | `components/target-list.tsx:352` | `text-amber-500`, `text-emerald-500` | estimate delta |
| 17 | `components/history-calendar.tsx:292` | `text-amber-500` | late clock icon |
| 18 | `components/help-assistant.tsx:85` | `text-amber-500` | docs icon |
| 19 | `components/sidebar.tsx:51` | `bg-white/[0.012]` | sidebar wash |
| 20 | `sidebar.tsx:82`, `notification-bell.tsx:47`, `calendar-view-switcher.tsx:22`, `ui/button.tsx:12`, `app/page.tsx:72,94` | `text-white` ×6 | text on brand surfaces |

**Scoped module palette:** `components/auth-form.module.css:8-24` defines its own 13-token dark palette plus ~12 literal gradients/shadows/rgba washes throughout (l.76-78, 94, 116-117, 151-156, 170, 222-223, 243-244, 385, 396, 452, 461-462) — intentionally isolated, but 100% dark-locked.

---

## Summary counts

| Category | Distinct findings (grouped) | Approx. instance count |
|---|---|---|
| 1 — Sits-on-canvas | 21 | ~30 class sites |
| 2 — Blends-with-canvas ⚠ | 12 token-level + 14 blur/glow/gradient + 8 alpha-utility recipes + auth module | **~150 alpha-utility instances** in ~35 files, + 12 tokens + ~20 literal glow/scrim/gradient sites |
| 3 — Surfaces tuned | 22 | ~90 class sites |
| 4 — Foreground tuned | 20 | ~110 class sites (incl. ~60 `text-primary`) |
| 5 — Hardcoded | 20 entries | ~45 literals + 6 `text-white` + module (~25) |

(Instances overlap across categories by design — e.g. `bg-brand-soft` is both sits-on-canvas and blends-with-canvas.)

---

## Theme-relative roles found (the token set every theme must define)

Surfaces & structure:
- **canvas** (`--bg` / legacy `--background` — currently two different values; unify) and **canvas-glow** (the `--bg-grad` accents)
- **surface-1** (card), **surface-2** (raised-in-card), **surface-3** (hover/control)
- **surface-overlay** (floating panels), **scrim** (modal backdrop)
- **line** (hairline), **line-2** (strong hairline), **input-border** (legacy `--input`)
- **track** (progress/ring empty state — today `--muted`, `--surface-3`, `--line-2`, `--secondary` are all used for this same role; consolidate)
- **elevation-shadow** (hover-shadow + panel-shadow tints)
- **chrome** (mobile `themeColor` — must be emitted per-theme in JS)

Text & icons:
- **text-primary** (body), **text-muted**, **text-faint**
- **text-on-brand** (replaces `text-white`), **text-on-accent** (`--primary-foreground` — currently = canvas color)
- **focus-ring** (`--ring` + the global `outline-ring/50`)
- **selection** and **color-scheme** (both currently unset — gaps)

Accents & status:
- **brand** (`--accent-1`/legacy `--primary`), **brand-2 / brand-gradient**, **brand-soft** (wash), **brand-line** (outline)
- **coral(+soft)** = streak/urgency, **green(+soft)** = success/on-time, **amber** = warning/late, **destructive** = danger, plus the currently-hardcoded **info/ahead** (indigo/blue) role
- **heat scale** (heatmap dots: none → 0% → low → mid → full → planned)
- **pillar accents** (user data, 11 presets + db rows) — needs a per-theme strategy (fixed palette per theme, or contrast-adjusted rendering)
- **unread-dot halo** (`ring-background` — must track canvas)

---

## Already token-driven (cheap) vs. hardcoded (needs migration first)

**Cheap — flows through `globals.css` vars.** The overwhelming majority: all `bg/text/border/ring-{background,foreground,card,popover,primary,secondary,muted,accent,destructive,input,ring}` and all redesign utilities (`bg-canvas`, `bg-surface-*`, `border-line*`, `text/bg/border-brand*`, `coral/green/amber`, `bg-surface-overlay`, `bg-scrim`, `.bg-app-canvas`, `.bg-brand-gradient`, `.ai-glow-card`, `.elevate-hover`). Redefining the two `:root` layers per theme retints ~85% of the app in one place. **Caveat:** the alpha-modified utilities (`bg-primary/10`, `text-muted-foreground/60`, …) are var-driven but bake *relative* transparency assumptions — each theme must validate them over its canvas, and the white-alpha `--surface-*`/`--line*` values must flip direction (black-alpha) for light themes.

**Needs migration before theming** (ordered by blast radius):
1. **`lib/pillar-icons.ts` + db-persisted pillar colors** — colors live in data, not CSS; biggest structural issue (also `lib/auth.ts:14` default).
2. **`text-white` on brand-soft washes** (6 sites) → `text-on-brand` token.
3. **Status colors in `lib/completion.ts`, `calendar-pillars-view.tsx`, `target-list.tsx`, `history-calendar.tsx`, `help-assistant.tsx`** → semantic status tokens.
4. **SVG gradient stops** in `today-progress-card.tsx` → reference `--accent-grad` stops via vars.
5. **Glow/shadow literals**: `ui/button.tsx:12`, `app/page.tsx:72,94`, `ui/dialog.tsx:34`, `history-calendar.tsx:228`, `globals.css:205`.
6. **`app/layout.tsx:23` themeColor + hardcoded `class="dark"`** — must become dynamic with the theme attribute.
7. **`components/sidebar.tsx:51` `bg-white/[0.012]`** → `bg-surface-*`.
8. **`login-characters.tsx`** 7 literals → vars (or accept per-theme art).
9. **`auth-form.module.css`** — decide: keep auth intentionally fixed-dark, or port its 13 local tokens onto the theme system.
10. Set **`color-scheme`** and **`::selection`** per theme (currently missing entirely).

---

## Fundamentally assumes dark — needs redesign, not a token swap

1. **White-alpha surface & hairline system** (`--surface-1/2/3`, `--line/2`, `--border/--input`, `bg-white/[0.012]`). "Surface = add white light" only makes sense on a dark canvas. A light theme needs the inverse model (black-alpha or opaque grays) *and* re-tuned elevation semantics — brighter≠higher on light. Every one of the ~150 alpha washes inherits this assumption.
2. **Glow-based affordances**: brand button purple glow shadows, `.ai-glow-card` corner bloom, today-cell `rgba(139,124,255,.7)` halo, auth panel halo/glows. Glows read as *light emission* against dark; over a light canvas they become smudges. Need a per-theme elevation/emphasis treatment (e.g. shadows on light, glows on dark).
3. **Dark scrim + blur glassmorphism**: `--scrim rgba(4,4,8,.66)` + `backdrop-blur`, `bg-background/70..95` glass bars, near-opaque dark `--surface-overlay`. On a light canvas a dark scrim is heavy and the "glass" tint flips; needs per-theme scrim color and overlay strategy.
4. **Shadow tints derived from the canvas**: `.elevate-hover` (`color-mix #18172d`), `shadow-background/60`, `rgba(0,0,0,.8)` dialog shadow — shadows *colored like the dark canvas* rather than a neutral shadow token.
5. **Pillar accent palette (user data)**: `#eab308`, `#84cc16`, `#06b6d4` chosen to pop on near-black; `#5d0018`, `#57534e` chosen as darks. No single 11-hex set survives arbitrary canvases — needs per-theme palettes or runtime contrast adjustment (the `hexToRgba` badge and opacity heatmap make this worse: intensity encoding via transparency inverts perceptually on light).
6. **`--primary-foreground = canvas color`** and **`ring-background` unread-dot halo** — foregrounds literally defined as "the canvas", an identity that breaks the moment canvas ≠ `#18172d`.
7. **Heatmap dot ladder** (`--tx-faint → coral → amber → accent-1 → green`): hue *and* lightness encode progress against dark; on light canvases `--amber`/`--green`/`--tx-faint` lose their ordering. Rebuild the ladder per theme.
8. **Auth experience** (`auth-form.module.css` + `login-characters.tsx`): noise grain via `soft-light` blend, black drop shadows, light-on-dark mascot color story (dark pupils on light sclera on dark bodies), light-red `#ff8a8a` error text — a fixed dark composition. Either exempt auth from theming or redesign it.
9. **Assets**: `public/icon.svg` + light/dark favicons switch on **OS** `prefers-color-scheme`, decoupled from the in-app theme (acceptable for favicons, but note the mismatch); `placeholder-logo.png/svg`, `placeholder.jpg/svg`, `placeholder-user.jpg` are v0 leftovers with transparency — verify unused before theming.
10. **Structural**: `class="dark"` is baked into `<html>` (`layout.tsx:34`) and `dark:` variants are scattered through `ui/button.tsx`/`ui/input.tsx` as permanently-on branches. The theme attribute must define what happens to the `dark` custom variant per theme, or those branches silently change behavior.
