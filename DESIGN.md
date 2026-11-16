# Compliance Tracker — Typography, Components & Motion

How text reads, how components are sized, and how things move in the Compliance Tracker app (`app/`). Written so the system can be lifted into another React + Tailwind v4 + `motion` project: copy section 7 (CSS) and section 8 (motion constants), then follow the tables.

**Daybook usage:** sections 1–9 define the **app system** (admin, staff portal, shared components and motion). **Section 10** defines the colour palette for everything. **Section 11** defines the **public site** (landing page and customer booking flow), which uses the same tokens, radii and motion but with a larger, touch-first scale. If section 11 and sections 1–9 conflict on a public page, section 11 wins.

**Font change:** this spec uses **Geist** as the sans face in place of Inter. Everything else (sizes, weights, spacing) is unchanged, and Geist's metrics are close enough to Inter that no size needs adjusting.

Sources: [`index.html`](../index.html), [`src/index.css`](../src/index.css), [`src/components/shell/dashboard-shell.css`](../src/components/shell/dashboard-shell.css), [`src/components/shell/primitives.tsx`](../src/components/shell/primitives.tsx), [`src/components/shell/DashboardShell.tsx`](../src/components/shell/DashboardShell.tsx), [`src/components/ui.tsx`](../src/components/ui.tsx), [`src/components/ThemeToggle.tsx`](../src/components/ThemeToggle.tsx), and the pages under `src/pages/`.

---

## 1. Font families

| Token | Stack | Used for |
|---|---|---|
| `font-sans` (body default) | **Geist** → ui-sans-serif → system-ui → -apple-system → Segoe UI → sans-serif | All UI: headings, body, labels, buttons, tables |
| `font-mono` | JetBrains Mono → ui-monospace → SFMono-Regular → Menlo → monospace | Entity codes, reference numbers, acknowledgement numbers, ID values, generated passwords |
| Serif | **None.** | No serif face is loaded or used anywhere in the app |

Weights loaded: Geist 400 / 500 / 600 / 700, JetBrains Mono 400 / 500.

Where `font-mono` appears:

| Element | Classes | File |
|---|---|---|
| Entity code badge (`.ent-code`) | `font-mono text-[11px] font-medium`, `bg-hover rounded-md px-1.5 py-0.5` | `index.css` |
| Reference / ack number inputs | `input font-mono` | `modals.tsx`, `Entities.tsx` |
| Reference number column | `td font-mono text-xs` | `Documents.tsx` |
| Import preview ack column | `td font-mono` | `ImportExport.tsx` |
| Temporary password field | `input font-mono` | `Team.tsx` |

Print report (`src/lib/print.ts`) uses its own inline stylesheet: change `font-family:Inter,…` to `font-family:Geist,Arial,Helvetica,sans-serif`.

---

## 2. Type scale

The app is a dense dashboard. The base size is **13px**, not 16px. There are no custom font-size tokens; sizes are Tailwind defaults plus a few pixel values.

| Size | px | Role | Where |
|---|---|---|---|
| `text-2xl` | 24 | Stat tile value | `Dashboard.tsx` → `Stat` (`font-semibold tabular-nums tracking-tight`) |
| `text-lg` | 18 | Small numeric highlight | Sidebar "Due this week" count, import preview counts (`font-semibold tabular-nums`) |
| `text-base` | 16 | Denominator inside a stat (`/total`) | `Dashboard.tsx` (`font-normal text-muted`) |
| `text-[15px]` | 15 | Page title (H1), modal title, confirm title, auth brand name, entity card name | `ShellPage`, `Modal`, `DashboardConfirmDialog`, `Auth.tsx`, `Entities.tsx` (all `font-semibold`) |
| `text-[14px]` | 14 | Section card title (H2) | `ui.tsx` → `Section` (`font-semibold`) |
| `text-sm` | 14 | Tables (`<table className="w-full text-sm">`), auth copy, settings intros, checkbox labels | Pages |
| `text-[13px]` | 13 | **Body default**, inputs, md buttons, nav items, tabs, menu items, toasts, popovers, modal subtitles, empty states | `body`, `.input`, shell primitives |
| `text-xs` | 12 | Labels, table headers, sm buttons, hints, status pill, tooltips, menu group labels, counts | `.label`, `.th`, `DashboardButton sm` |
| `text-[11px]` | 11 | Micro: chips, entity code, nav counts, sidebar section titles, brand subtitle, role under account name, group header rows | `Chip`, `.ent-code`, `DashboardShell.tsx`, `Tasks.tsx` |

### Rules

- Dense UI stays on 13px / 12px. Don't use `text-base` for body copy inside lists or tables.
- Titles only go up to 15px. Size jumps are reserved for numbers (stat values).
- Table body text is `text-sm` (14px), set on the `<table>` itself.

---

## 3. Weights

| Weight | Use |
|---|---|
| `font-normal` (400) | Body copy, the "/total" part of a stat |
| `font-medium` (500) | Buttons, labels, table headers, tabs, active nav item, chips, counts, menu labels, status pill, account name |
| `font-semibold` (600) | Page / modal / section titles, stat values, brand name, avatar initials, uppercase group headers |
| `font-bold` (700) | Loaded but not used in the UI |

---

## 4. Tracking, leading and numerals

- **Page title:** `tracking-[-0.01em]`.
- **Stat value:** `tracking-tight` (-0.025em).
- **Uppercase micro headers:** `text-[11px]` or `text-xs`, `font-semibold uppercase tracking-wide text-muted` (task group rows in `Tasks.tsx`, section headers in `RecycleBin.tsx`).
- **Uppercase avatar initials:** `text-xs font-semibold uppercase` in a round `size-7` / `size-8` tile.
- **Leading:** `leading-tight` for two-line stacks (brand name + subtitle, account name + role). Everything else uses the default.
- **`tabular-nums`** on every number that changes or lines up in columns: stat values, counts in tabs and nav, due dates in tables, "N selected", sidebar weekly count.
- **Truncation:** nav labels, brand text and filter values use `truncate whitespace-nowrap`. Filter values cap at `max-w-40`.
- **Rendering:** `antialiased` on `body`. `input, select, textarea, button { font: inherit }` so form controls never fall back to system fonts.

---

## 5. Components (sizes and text)

### Buttons (`DashboardButton`)

Base: `inline-flex items-center rounded-lg font-medium whitespace-nowrap`, `transition-[background-color,color,box-shadow] duration-150`, focus `ring-3 ring-accent/25`, disabled `opacity-45`.

| Size | Classes |
|---|---|
| `sm` (default) | `h-7 px-2.5 text-xs gap-1.5` |
| `md` | `h-8 px-3 text-[13px] gap-1.5` |
| `icon` | `size-7 justify-center` |

| Variant | Look |
|---|---|
| `primary` | `bg-accent text-white hover:bg-accent-hover` + inset highlight `0 1px 0 rgb(255 255 255/.15) inset, 0 1px 2px rgb(0 0 0/.12)` |
| `secondary` | `bg-surface border border-line hover:bg-hover` + `0 1px 2px rgb(0 0 0/.04)` |
| `muted` | `bg-hover hover:bg-[active]` |
| `ghost` | `text-muted hover:text-ink hover:bg-hover` |
| `danger` | `text-danger hover:bg-danger/10` |

Login and full-width buttons override to `h-9`.

### Inputs

| Class | Spec |
|---|---|
| `.input` | `h-8 rounded-lg border border-line px-2.5 text-[13px]`, placeholder `text-muted/70`, focus `border-accent ring-3 ring-accent/15`, `transition` |
| `textarea.input` | `h-auto py-1.5` |
| `.input-sm` (inline table edit) | `h-7 rounded-md border-transparent bg-transparent px-1.5 text-xs`; border shows on hover, fills on focus |
| `.label` | `mb-1 block text-xs font-medium text-muted` |
| Field hint | `mt-1 block text-xs text-muted` |

Auth form inputs use `h-9`.

### Tables

| Class | Spec |
|---|---|
| `<table>` | `w-full text-sm` |
| `.th` | `h-9 px-3 text-left text-xs font-medium text-muted whitespace-nowrap border-b border-line` |
| `.td` | `h-11 px-3 align-middle border-b border-line` |
| Row hover | `hover:bg-canvas/60` |
| Group header row | `bg-canvas px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted` |

### Chip / badge / status

| Component | Spec |
|---|---|
| `Chip` | `inline-flex h-5 px-1.5 rounded-md text-[11px] font-medium ring-1 ring-inset` (colour classes passed in) |
| `.ent-code` | `rounded-md bg-hover px-1.5 py-0.5 font-mono text-[11px] font-medium` |
| Nav count | `rounded-md bg-hover px-1.5 text-[11px] font-medium tabular-nums text-muted` |
| Page status pill | `h-6 rounded-full border border-line px-2 text-xs font-medium text-muted` with a `size-1.5` coloured dot |

### Cards, sections, stats

| Component | Spec |
|---|---|
| `.card` | `rounded-xl border border-line bg-surface` |
| `Section` | `card mb-4 p-5`; icon tile `size-8 rounded-lg bg-hover`; title `text-[14px] font-semibold`; description `mt-0.5 text-[13px] text-muted` |
| `Stat` | `rounded-xl border border-line p-4`; label row `text-xs text-muted` with `size-3.5` icon; value `mt-2 text-2xl font-semibold tabular-nums tracking-tight`; hint `mt-0.5 text-xs text-muted` |
| `EmptyState` | `rounded-xl border border-dashed px-6 py-14 text-center text-muted`; icon tile `size-11 rounded-xl bg-hover`; text `max-w-sm text-[13px]` |
| Sidebar card | `rounded-xl border bg-canvas p-3 text-xs` |

### Shell

| Part | Spec |
|---|---|
| Sidebar | Default 200px, resizable 180–400px, collapses to a 56px icon rail (⌘B / Ctrl+B). Below 672px container width it becomes a drawer `w-[min(300px,86vw)]` |
| Brand row | `h-14 px-[14px]`; logo `size-7 rounded-lg`; name `text-[13px] font-semibold`; description `text-[11px] text-muted` |
| Section title | `h-5 px-2.5 text-[11px] font-medium text-muted` (becomes a 1px rule when collapsed) |
| Nav item | `h-8 rounded-lg px-3 gap-2.5 text-[13px]`; icon 16px; active `font-medium text-ink`, inactive `text-ink/80` (secondary nav `text-muted`) |
| Page header | `min-h-14 px-4 py-2.5 sm:px-6`; title `text-[15px] font-semibold tracking-[-0.01em]`; `h-4 w-px` divider after the sidebar toggle |
| Tabs | `h-7 rounded-lg px-2.5 text-[13px] font-medium`; count `text-xs tabular-nums text-muted` |
| Toolbar | `border-y border-line px-4 py-2 sm:px-6`, items `gap-1.5` |
| Content | `px-4 py-5 sm:px-6`, inside an `@container` |
| Filter menu trigger | Secondary sm button split as `Label │ Value ⌄`; label `text-muted`, value `max-w-40 truncate` (`text-accent` when a filter is set) |

### Overlays

| Component | Spec |
|---|---|
| Menu | `.obsidian-glass rounded-xl p-1 text-[13px] min-w-44`, max height `min(70vh, available)` |
| Menu item | `h-8 rounded-lg px-2.5 gap-2`, icons `size-4 text-muted`; checked indicator at `right-2.5` |
| Menu label | `px-2.5 pb-1 pt-2 text-xs font-medium text-muted` |
| Popover | `.obsidian-glass rounded-xl p-3 text-[13px]` |
| Modal | `rounded-2xl border`, default `max-w-xl`, top offset `sm:pt-[8vh]`; header `px-5 pt-4 pb-1`; title `text-[15px] font-semibold`; subtitle `text-[13px] text-muted`; body `px-5 py-4 space-y-4`; footer `border-t px-5 py-3 gap-2` |
| Confirm dialog | `w-[min(400px,calc(100vw-32px))] rounded-2xl p-5 top-[22vh]`; title 15px semibold; description `mt-1.5 text-[13px] text-muted`; md buttons |
| Tooltip (rail) | `.obsidian-glass rounded-lg px-2.5 py-1.5 text-xs font-medium`, `sideOffset 10`, delay 80ms |
| Toast | `.obsidian-glass rounded-xl px-3.5 py-2.5 text-[13px]`, 16px icon, bottom-right, `w-[min(380px,100vw-2rem)]` |
| Overlay scrim | `bg-black/25 backdrop-blur-[2px]` (drawer: `bg-black/30`) |
| Frosted glass (`.obsidian-glass`) | `backdrop-filter: blur(16px) saturate(1.6)`, 1px border, shell shadow |

### Radius scale

`rounded-md` (6px) chips and small inline controls · `rounded-lg` (8px) buttons, inputs, nav, tabs, menu items · `rounded-xl` (12px) cards, menus, toasts · `rounded-2xl` (16px) modals and the auth card · `rounded-full` avatars, status pill, dots.

### Scrollbars

`.obsidian-scroll`: a 4px scrollbar that's invisible until the pointer or focus is inside the area.

---

## 6. Motion

Library: **`motion`** (`motion/react`) for springs, layout, enter/exit and stagger. Plain CSS transitions handle colour and border changes. The View Transitions API handles the theme switch.

### Springs

| Name | Spec | Used by |
|---|---|---|
| `PILL_SPRING` | stiffness 520, damping 40, mass 0.7 | Every gliding highlight: nav active/hover, tab pill/hover, menu item highlight; sidebar-toggle icon rotation |
| `LAYER_SPRING` | stiffness 520, damping 34, mass 0.6 | Menus and popovers opening |
| `ICON_SPRING` | stiffness 520, damping 32 | Theme toggle sun/moon swap |
| `TOOLTIP_SPRING` | stiffness 520, damping 34 | Rail tooltip |
| `SURFACE_SPRING` | stiffness 460, damping 34 | Modal, toast, bulk-action bar |
| `CONFIRM_SPRING` | stiffness 480, damping 34 | Confirm dialog |
| `WIDTH_SPRING` | stiffness 420, damping 40, mass 0.8 | Sidebar expand/collapse width |
| `DRAWER_SPRING` | stiffness 420, damping 40 | Mobile nav drawer slide |
| `NAV_INTRO_SPRING` | stiffness 380, damping 30 | First-load nav stagger |
| Auth card | `type: spring, duration 0.5, bounce 0.15` | Login card entrance |

### Tweens

| Duration / ease | Used by |
|---|---|
| 150ms CSS (`duration-150`) | Button background, colour and shadow |
| Tailwind default 150ms (`transition`, `transition-colors`) | Inputs, nav and tab text colour, row hover, resize handle |
| 0.15s | Modal scrim fade |
| 0.18s | Drawer scrim, entity chevron rotate (0→90°), sidebar card height |
| 0.16s `easeOut` (`LABEL_FADE`) | Sidebar labels fading/sliding in |
| 0.22s `[0.4, 0, 0.2, 1]` | `Collapse` height + opacity |
| 0.22s `easeOut` | Page content on mount and tab change: opacity 0→1, y 4→0 |
| 0.10–0.14s | Quick exits: labels (0.1), modal (0.12), toast and bulk bar (0.14) |

### Enter / exit recipes

The house style is **opacity + small offset + scale 0.96–0.98 + blur that clears**. Elements come into focus rather than just fading in.

| Element | Initial → animate | Exit |
|---|---|---|
| Menu / popover | `opacity 0, scale 0.96, blur(6px), y -2` → normal | Unmounts (Radix) |
| Modal | `opacity 0, y 8, scale 0.98, blur(6px)` → normal | `opacity 0, y 6, scale 0.98, blur(4px)`, 0.12s |
| Confirm dialog | `opacity 0, scale 0.96, blur(6px)` → normal | — |
| Toast | `opacity 0, y 12, scale 0.97, blur(4px)` → normal; `layout` so the stack reflows | `opacity 0, x 24` (slides right), 0.14s |
| Bulk-action bar | `opacity 0, y 16, scale 0.97, blur(6px)` → normal | `opacity 0, y 12, scale 0.97`, 0.14s |
| Tooltip | `opacity 0, x -4, blur(4px)` → normal | — |
| Sidebar label / brand / account | `opacity 0, x -6` → normal | `opacity 0, x -6`, 0.1s |
| Collapsed nav count dot | `scale 0` → 1 | `scale 0` |
| Section title ↔ rule (collapse) | Title fades; rule `scaleX 0 → 1` | Title 0.08s |
| Drawer | `x -100%` → 0 | `x -100%` |
| Login error | `opacity 0, height 0` → auto | Reverse |
| Import preview / results | `opacity 0, y 4–6` → normal | — |

### Lists and layout

- **Table rows** (Dashboard, Tasks, Documents, Team): `motion.tr` with `layout="position"`, fade in and out (`opacity 0 ↔ 1`) inside `AnimatePresence initial={false}`. Rows slide into place when sorting or filtering, and the first render doesn't animate.
- **Recycle bin items:** `layout`, exit `opacity 0, height 0`.
- **Entity cards:** `layout="position"`.
- **Activity feed stagger:** `opacity 0, x -4` → normal, delay `min(i, 20) × 15ms` (capped so long lists don't drag).
- **Nav intro stagger:** first app mount only. `opacity 0, x -8, blur(3px)` → normal, delay `50ms + index × 35ms`, running across all sections top to bottom.

### Gliding highlight

One shared `motion.span` with a `layoutId` sits behind the hovered or active item (`absolute inset-0 -z-10 rounded-[inherit]`) and moves between items on `PILL_SPRING`. It's used for nav (separate hover and active pills), tabs (separate hover and active pills) and menu items (hover/focus). Touch pointers don't set hover.

### Theme switch (View Transitions)

`ThemeToggle variant="circle-blur"`: a circle grows from the button's centre, `clip-path: circle(0% → 150%)` with `blur(8px → 0)`, over **700ms `cubic-bezier(0.4, 0, 0.2, 1)`**. Other available variants:

| Variant | Animation |
|---|---|
| `rectangle` | `clip-path inset(...)` → `inset(0)`, 400ms ease-out, from a chosen edge |
| `circle` | Circle reveal, 700ms, no blur |
| `blinds` | 72px masked slats widen, 700ms `cubic-bezier(0.16, 1, 0.3, 1)` |

The icon swap: `opacity 0, scale 0.6, rotate -45°, blur(2px)` in; `rotate +45°` out; `AnimatePresence mode="popLayout"`.

### Other

- **Sidebar toggle icon:** rotates 180° when collapsed (`PILL_SPRING`).
- **Spinners:** `Loader2` + `animate-spin` (16px in buttons, 24px full-screen).
- **Resize handle:** 1px line goes `bg-accent/60` on hover and solid `bg-accent` while dragging. Width animation is turned off during drag.

### Reduced motion

Every motion component reads `useReducedMotion()`. When it's on, springs become `{ duration: 0 }`, `initial` is `false`, exits become a plain opacity fade, page fades are skipped, and the theme switch skips the view transition. Keep this in anything you add.

---

## 7. Import: CSS (Tailwind v4)

**`index.html`**

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

To self-host instead, install the `geist` npm package and point an `@font-face` rule at its `.woff2` files.

**`index.css`**

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
}

/* Map these to your own palette variables. */
@theme inline {
  --color-canvas: var(--subtle);
  --color-surface: var(--background);
  --color-line: var(--border);
  --color-ink: var(--foreground);
  --color-muted: var(--text-muted);
  --color-hover: var(--hover);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-danger: var(--danger);
}

@layer base {
  html, body, #root { height: 100%; }
  body { @apply bg-surface text-ink font-sans text-[13px] antialiased; }
  input, select, textarea, button { font: inherit; }
}

@layer components {
  .input {
    @apply h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink
      outline-none transition placeholder:text-muted/70
      focus:border-accent focus:ring-3 focus:ring-accent/15
      disabled:bg-canvas disabled:text-muted;
  }
  textarea.input { @apply h-auto py-1.5; }
  .input-sm {
    @apply h-7 rounded-md border border-transparent bg-transparent px-1.5 text-xs outline-none transition
      hover:border-line focus:border-accent focus:bg-surface focus:ring-3 focus:ring-accent/15;
  }
  .label { @apply mb-1 block text-xs font-medium text-muted; }
  .card  { @apply rounded-xl border border-line bg-surface; }
  .th    { @apply h-9 whitespace-nowrap border-b border-line px-3 text-left text-xs font-medium text-muted; }
  .td    { @apply h-11 border-b border-line px-3 align-middle; }
  .ent-code { @apply inline-block rounded-md bg-hover px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink; }
}

.glass {
  background: var(--menu);                 /* light: rgb(255 255 255 / .82), dark: rgb(24 24 27 / .78) */
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 8px 24px -6px rgb(0 0 0 / .12);
}
```

---

## 8. Import: motion constants

```ts
// motion.ts
export const PILL_SPRING     = { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 } as const
export const LAYER_SPRING    = { type: 'spring', stiffness: 520, damping: 34, mass: 0.6 } as const
export const ICON_SPRING     = { type: 'spring', stiffness: 520, damping: 32 } as const
export const SURFACE_SPRING  = { type: 'spring', stiffness: 460, damping: 34 } as const
export const CONFIRM_SPRING  = { type: 'spring', stiffness: 480, damping: 34 } as const
export const WIDTH_SPRING    = { type: 'spring', stiffness: 420, damping: 40, mass: 0.8 } as const
export const DRAWER_SPRING   = { type: 'spring', stiffness: 420, damping: 40 } as const
export const NAV_INTRO_SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const

export const LABEL_FADE = { duration: 0.16, ease: 'easeOut' } as const
export const COLLAPSE   = { duration: 0.22, ease: [0.4, 0, 0.2, 1] } as const

/** Menus, popovers. */
export const layerIn = { initial: { opacity: 0, scale: 0.96, filter: 'blur(6px)', y: -2 }, animate: { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 } }
/** Modals. */
export const modalIn = {
  initial: { opacity: 0, y: 8, scale: 0.98, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: 6, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.12 } },
}
/** Toasts. */
export const toastIn = {
  initial: { opacity: 0, y: 12, scale: 0.97, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, x: 24, transition: { duration: 0.14 } },
}
/** Page content on mount / tab change. */
export const pageIn = { opacity: [0, 1], y: [4, 0] }  // animate(el, pageIn, { duration: 0.22, ease: 'easeOut' })
/** List stagger, capped at 20 items. */
export const staggerDelay = (i: number) => Math.min(i, 20) * 0.015
```

---

## 9. Rules of thumb

- 13px body, 15px titles, 24px only for stat numbers.
- Medium for anything interactive, semibold for titles and numbers. Never bold.
- `tabular-nums` on any number that changes or sits in a column.
- Mono only for codes and identifiers, never for prose.
- No serif. If one is added later, use it for a single editorial accent (for example an empty-state headline) and keep it out of controls and tables.
- Uppercase only for 11–12px group headers (with `tracking-wide`) and avatar initials.
- Enter with blur + slight scale; exit faster than you enter (0.1–0.14s).
- Everything that glides uses `PILL_SPRING` so it moves as one system.
- Respect `useReducedMotion()` in every animated component.

---

## 10. Colour

Brand colours: **Pampas `#FDFDFC`** (background), **Ebony `#111827`** (text), **Hollywood Cerise `#FF00AA`** (accent).

> **Per-salon rebrand:** the four brand tokens (`--brand`, `--accent`, `--accent-hover`, `--accent-soft`) are set from `site.colors` in `lib/site.ts`, which overrides the defaults below for light and dark mode. Change colours there, not in `globals.css`. Keep `accent` dark enough for white button text (4.5:1).

### Accessibility rule for the accent

`#FF00AA` is only **3.5:1** on the background and **3.6:1** with white text. That's below the 4.5:1 needed for normal text, so the brand cerise is **never used for small text or as a fill behind small white text**. Use it as is for:

- decoration: dots, underlines, highlights, star ratings, the active tab or nav indicator, selected-state borders, focus rings
- display-size text, 24px and up (large text needs 3:1): one accent word in a hero or section headline
- fills behind **Ebony** text (4.9:1), e.g. a badge or sticker

For buttons, links and small accent text, use the **deeper shades** below. They read as the same pink.

### Tokens (light, default)

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--background` → `surface` | `#FDFDFC` | Page and card background | — |
| `--subtle` → `canvas` | `#F6F6F3` | Section bands, table group rows, sidebar | — |
| `--hover` | `#F0F0EC` | Hover fills, muted buttons, code badges | — |
| `--active` | `#E8E8E3` | Pressed muted button | — |
| `--border` → `line` | `#E6E6E1` | Borders, dividers, table rules | — |
| `--foreground` → `ink` | `#111827` | All body text and headings | 17.4:1 |
| `--text-muted` → `muted` | `#5F6672` | Secondary text, labels, hints | 5.7:1 (5.1:1 on `--hover`) |
| `--brand` → `brand` | `#FF00AA` | Decorative accent (see rule above) | 3.5:1, large text only |
| `--accent` → `accent` | `#D6008F` | Primary buttons (white text), links, focus rings | 4.9:1 with white |
| `--accent-hover` | `#B8007B` | Primary hover; accent text on soft fills | 6.3:1 with white |
| `--accent-soft` | `#FFE6F5` | Selected chips/slots tint, selection highlight, soft badges | `#B8007B` on it: 5.4:1 |
| `--danger` | `#DC2626` | Destructive actions, errors | 4.7:1 |
| `--success` | `#15803D` | Confirmed / paid states | 4.9:1 |
| `--warning` | `#B45309` | Pending holds, attention | 4.9:1 |
| `--menu` | `rgb(253 253 252 / .82)` | `.glass` / `.obsidian-glass` fill | — |

### Tokens (dark, app only)

The **public site is light only** for v1. Dark mode applies to admin and the staff portal (`.dark` class, toggle from section 6).

| Token | Value |
|---|---|
| `--background` | `#0E121B` |
| `--subtle` | `#151A24` |
| `--hover` | `#1B212C` |
| `--active` | `#232A36` |
| `--border` | `#262C38` |
| `--foreground` | `#F4F4F2` (17:1) |
| `--text-muted` | `#9CA3AF` (7.4:1) |
| `--brand` | `#FF3DBB` (5.9:1, OK for text on dark) |
| `--accent` | `#D6008F` (fills with white text) |
| `--accent-hover` | `#E0109C` |
| `--accent-soft` | `rgb(255 0 170 / .14)` |
| `--danger` / `--success` / `--warning` | `#F87171` / `#4ADE80` / `#FBBF24` |
| `--menu` | `rgb(21 26 36 / .78)` |

### CSS (add to `app/globals.css` with section 7)

```css
:root {
  --background: #FDFDFC; --subtle: #F6F6F3; --hover: #F0F0EC; --active: #E8E8E3;
  --border: #E6E6E1; --foreground: #111827; --text-muted: #5F6672;
  --brand: #FF00AA; --accent: #D6008F; --accent-hover: #B8007B; --accent-soft: #FFE6F5;
  --danger: #DC2626; --success: #15803D; --warning: #B45309;
  --menu: rgb(253 253 252 / .82);
}
.dark {
  --background: #0E121B; --subtle: #151A24; --hover: #1B212C; --active: #232A36;
  --border: #262C38; --foreground: #F4F4F2; --text-muted: #9CA3AF;
  --brand: #FF3DBB; --accent: #D6008F; --accent-hover: #E0109C; --accent-soft: rgb(255 0 170 / .14);
  --danger: #F87171; --success: #4ADE80; --warning: #FBBF24;
  --menu: rgb(21 26 36 / .78);
}
@theme inline {
  /* in addition to the mappings in section 7 */
  --color-brand: var(--brand);
  --color-accent-soft: var(--accent-soft);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-active: var(--active);
}
::selection { background: var(--accent-soft); color: var(--foreground); }
```

Keep pink to roughly **one accent moment per screen** (the primary CTA plus one decorative touch). The palette is mostly Pampas and Ebony; the cerise is the punctuation.

---

## 11. Public site (landing page + customer booking)

Customers are on phones, often on 4G, often one-handed. The public site is **airy, photo-led and touch-first**: the opposite density of the admin, but built from the same tokens, radii and motion.

### 11.1 Type scale

Body is **16px**, not 13px. Geist throughout. Headlines are Geist semibold with tight tracking, so they feel editorial without a second face.

| Role | Size | Weight / tracking / leading | Notes |
|---|---|---|---|
| Hero display | `clamp(2.5rem, 8.5vw, 4.5rem)` (40 → 72px) | `font-semibold tracking-[-0.035em] leading-[1.02]` | One word or phrase may be `text-brand` |
| Section title (H2) | `clamp(1.75rem, 4.5vw, 2.75rem)` (28 → 44px) | `font-semibold tracking-[-0.025em] leading-[1.1]` | Max ~14 words |
| Card / item title (H3) | 18px, 20px from `md` | `font-semibold tracking-[-0.01em]` | Service names, staff names |
| Lead paragraph | 17px, 19px from `md` | `font-normal leading-relaxed text-muted` | Max width `max-w-[56ch]` |
| Body | 16px | `leading-[1.6]` | Max width `max-w-[65ch]` for prose |
| Small / meta | 14px | `text-muted` | Durations, captions, footnotes |
| Eyebrow | 12px | `font-medium uppercase tracking-[0.12em] text-accent-hover` | Above section titles. Uppercase is allowed here (exception to rule 9). |
| Price | inherits | `font-semibold tabular-nums` | Always `₹1,200` (en-IN format). "from" prefix in `text-muted font-normal`. |
| Stat (rating, years, clients) | `clamp(2rem, 5vw, 3rem)` | `font-semibold tabular-nums tracking-tight` | e.g. "4.9★", "6 yrs" |

Rules still apply: medium for interactive, semibold for titles and numbers, never bold, mono only for the booking code.

### 11.2 Layout

| Item | Spec |
|---|---|
| Design width | Start at **375px**, verify at 360px. Then `sm` 640, `md` 768, `lg` 1024, `xl` 1280. |
| Container | `mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8` (16px gutter on phones) |
| Section spacing | `py-16 md:py-24 lg:py-28`. Alternate `bg-surface` and `bg-canvas` bands to separate sections; no heavy dividers. |
| Section header | Eyebrow → `mt-3` title → `mt-4` lead. Left-aligned on mobile; may centre on `lg` for gallery/testimonials. |
| Grid gaps | `gap-3` (image grids on mobile), `gap-4 md:gap-6` (cards) |
| Horizontal overflow | **Never.** Carousels scroll inside their own container with `overflow-x-auto snap-x snap-mandatory`, bleeding to the screen edge with `-mx-4 px-4`, scrollbar hidden. |
| Safe areas | Fixed bottom elements add `pb-[max(12px,env(safe-area-inset-bottom))]` |

### 11.3 Landing page sections (in order)

1. **Header**: sticky, `h-14 md:h-16`. Transparent over the hero, then `.glass` + bottom border after 8px of scroll. Logo left; on `md+` nav links (15px, `font-medium text-ink/80`, gliding hover pill on `PILL_SPRING`) and a **Book now** button right. On mobile: Book now (sm) + menu button that opens a right-side drawer (`DRAWER_SPRING`, `w-[min(320px,86vw)]`, links at 20px with `py-3`, full-width Book CTA at the bottom).
2. **Hero**: mobile: eyebrow (location, e.g. "Nail studio · Gurugram"), headline, lead, two buttons (primary **Book an appointment**, secondary **See our work**), then a trust row (★ 4.9 Google · 2,000+ clients). Image below: a 4:5 photo or a 2-image offset collage. `lg+`: two columns, text left (5/12), imagery right (7/12). The hero image uses `priority` and is the LCP element.
3. **Services & prices**: category tabs (gliding pill, horizontally scrollable on mobile). Under each tab, a list of rows: name (H3) + one-line description (14px muted) on the left; duration (14px muted) and price on the right. Each row has a ghost **Book** action that adds the service and goes to `/book`. On `lg`, 2 columns of rows. No cards with heavy borders; use `border-b border-line` rows with `py-4`.
4. **Portfolio**: filter chips (All, Gel, Extensions, Nail art, Pedicure…). Grid: 2 columns on mobile, 3 on `md`, 4 on `xl`, images `aspect-[4/5]`. Featured items may span 2 rows on `md+`. Tap opens a lightbox (full-screen, swipe/arrow keys, caption + "Book this look" button). Filter changes animate with `layout` (section 6, lists).
5. **Reels from Instagram**: horizontal snap carousel of `aspect-[9/16]` cards, `w-[62vw] max-w-[260px]`. Each card is a **facade**: our stored thumbnail + play icon + Instagram glyph. Tap loads the real embed in a modal (never in the page flow). "Follow us on Instagram" link at the end.
6. **Team**: staff cards, 2 columns on mobile, 4 on `lg`. Photo `aspect-[4/5] rounded-2xl`, name (H3), specialties (14px muted). Card links to booking with that technician preselected.
7. **Testimonials / reviews**: snap carousel on mobile, 3-column grid on `lg`. Card: `card p-6`, stars in `text-brand`, quote at 16px, name + service in 14px muted. Optional review reels reuse the reel facade. Google rating badge at the section header.
8. **Visit us**: address, hours table (today highlighted with `bg-accent-soft`), phone, **WhatsApp** and **Get directions** buttons, map embed (`aspect-[4/3] md:aspect-[16/9] rounded-2xl`, lazy-loaded).
9. **Final CTA band**: `bg-ink text-surface` (Ebony band, the one dark moment on the page), a large title with one `text-brand` word, and a primary button.
10. **Footer**: `bg-canvas`, logo, short line, links, Instagram, hours, small legal row (privacy, cancellation policy).

**Mobile sticky CTA**: after the hero scrolls out of view, a bottom bar slides up (`SURFACE_SPRING`, enter `y 100% → 0`) with a full-width **Book an appointment** button. Hidden on `/book` and when the footer is visible. `md+` doesn't need it (the header CTA is always visible).

### 11.4 Public components

| Component | Spec |
|---|---|
| Button `lg` (hero, CTA band, sticky bar) | `h-12 px-6 rounded-full text-[16px] font-medium gap-2` |
| Button `md` (default public) | `h-11 px-5 rounded-full text-[15px] font-medium gap-2` |
| Button `sm` (header, inline) | `h-9 px-4 rounded-full text-[14px] font-medium` |
| Variants | Same as section 5: `primary` = `bg-accent text-white hover:bg-accent-hover`, `secondary` = `bg-surface border border-line hover:bg-hover`, `ghost` = `text-ink hover:bg-hover`. Focus `ring-3 ring-brand/30`. |
| Text link | `text-accent-hover underline decoration-brand/40 underline-offset-4 hover:decoration-brand` |
| Filter / category chip | `h-9 px-4 rounded-full border border-line text-[14px] font-medium`; selected `bg-ink text-surface border-ink` (Ebony, not pink, so the pink stays for CTAs) |
| Image | `rounded-2xl overflow-hidden bg-canvas` (canvas shows while loading), `object-cover`, always `next/image` with `sizes`. Hover zoom `scale-[1.03]` over 500ms **only** under `@media (hover:hover)`. |
| Card | `card p-5 md:p-6` (`rounded-xl border border-line bg-surface`); public cards may use `rounded-2xl` |
| Star rating | 16px stars, `text-brand`, `aria-label="Rated 5 out of 5"` |

Radius on the public site: `rounded-full` buttons and chips · `rounded-xl` inputs and small cards · `rounded-2xl` images, large cards, modals, lightbox.

### 11.5 Booking flow (`/book`)

Touch-first versions of the app components. **Every input is at least 16px** (iOS Safari zooms into anything smaller) and every target is at least **44px**.

| Element | Spec |
|---|---|
| Page | Single column `max-w-[640px]` on mobile and `md`; from `lg`, a 2-column layout: steps (7/12) + sticky summary card (5/12, `top-24`). |
| Progress | Step labels on `md+` ("Services · Artist · Time · Details · Pay"); on mobile "Step 2 of 5" + a 4px progress bar (`bg-hover`, fill `bg-brand`, width animates on `PILL_SPRING`). |
| Step title | 22px / 24px `md`, `font-semibold tracking-[-0.02em]` |
| Service row (selectable) | `min-h-16 rounded-xl border border-line p-4`, name + duration left, price right, checkbox circle `size-6`. Selected: `border-brand bg-accent-soft`, check `bg-accent text-white`. |
| Technician card | Avatar `size-14 rounded-full`, name, specialties. 2-column grid on mobile. First option is always **Any available** (icon tile in place of a photo). Selected: `ring-2 ring-brand`. |
| Date strip | Horizontal snap row of `w-16 h-[72px] rounded-xl border` tiles: weekday (12px muted uppercase), day number (20px semibold tabular-nums). Selected: `bg-ink text-surface`. Closed: `opacity-40 line-through` and not focusable. |
| Time slot chip | Grid `grid-cols-3 sm:grid-cols-4 gap-2`, chip `h-11 rounded-full border border-line text-[15px] font-medium tabular-nums`. Selected: `bg-accent text-white border-accent`. Grouped under "Morning / Afternoon / Evening" eyebrows. |
| Input | `h-12 rounded-xl border border-line px-4 text-[16px]`, focus `border-accent ring-3 ring-accent/15`. Label `text-[14px] font-medium mb-1.5`. Error `text-[14px] text-danger mt-1.5`. Phone input has a fixed `+91` prefix. |
| Summary bar (mobile) | Fixed bottom `.glass border-t`, left: "2 services · 1h 30m" (14px muted) + total (18px semibold); right: Continue button `md`. Safe-area padding. |
| Payment step | Line items, total, **"Pay now: ₹500"** in large type, "Remaining ₹1,700 at the salon" in muted, cancellation policy in 14px, primary `lg` button "Pay ₹500". |
| Confirmation | Check icon in a `size-16 rounded-full bg-accent-soft text-accent-hover` tile (scale `0.6 → 1` on `ICON_SPRING`), title, booking code in `font-mono` `.ent-code` style at 15px, details card, **Add to calendar** + **WhatsApp us** buttons. |
| Errors | Inline banner `rounded-xl bg-danger/8 text-danger p-4 text-[15px]`. Payment failures always state whether money was taken. |

### 11.6 Public motion

Same libraries and springs as section 6, applied gently. Nothing should delay reading or tapping.

| Element | Spec |
|---|---|
| Scroll reveal (section headers, cards) | `opacity 0, y 12, blur(4px)` → normal, 0.5s `easeOut`, once, `viewport={{ once: true, amount: 0.2 }}` |
| Reveal stagger | 60ms per item, capped at 6 items |
| Hero intro | Eyebrow → headline → lead → buttons, 70ms apart, 0.6s `easeOut`, `y 16 → 0` with blur clearing. The image fades in (no movement) so LCP isn't delayed. |
| Tabs, chips, nav hover | Gliding pill on `PILL_SPRING` (section 6) |
| Gallery filter | Items use `layout`; removed items fade out in 0.14s |
| Lightbox / reel modal | `modalIn` (section 8); swipe between images with drag + spring |
| Booking step change | Outgoing `opacity 0, x -12` (0.14s), incoming `opacity 0, x 12 → 0` (0.22s `easeOut`); reversed when going back |
| Sticky CTA bar | `y 100% → 0` on `SURFACE_SPRING` |
| Not allowed | Parallax, scroll-jacking, auto-advancing carousels, autoplaying video with sound, animations longer than 0.7s |

`useReducedMotion()`: no reveals or transforms, show content immediately, keep only opacity fades of 0.15s or less.

### 11.7 Performance and SEO (part of the design)

- LCP under 2.5s on a mid-range Android over 4G. The hero image is the only `priority` image; everything below the fold is lazy.
- Portfolio images are served by `next/image` with correct `sizes` (`(min-width:1024px) 25vw, 50vw`).
- No Instagram, Google Maps or other third-party scripts load until the user taps or the section is near the viewport.
- Every page has a unique title, description and Open Graph image (1200×630, Pampas background, a photo, the logo, one pink accent) for WhatsApp and Instagram previews.
- `NailSalon` JSON-LD on the landing page (name, address, geo, hours, phone, price range, rating).

### 11.8 Public rules of thumb

- 16px body, 44px targets, 16px inputs. Phone first, always.
- Pampas and Ebony carry the page; **cerise is punctuation**: the primary CTA, one headline word, stars, selected states.
- Never white text on `#FF00AA`. Buttons use `--accent` (`#D6008F`).
- Photos do the selling: big, consistent `4:5` crops, `rounded-2xl`, no filters or borders.
- One dark moment per page (the final CTA band).
- Motion reveals once, quickly, and never blocks a tap.
