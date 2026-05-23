# Design System — Architect UI

## 1. Visual Theme & Atmosphere

Architect's UI is a study in editorial minimalism — a design system built on cream, near-black, and negative space. The page background is an off-white cream (`#fcfcfb`) rather than pure white, giving it a slight warmth that prevents the harshness of a blank sheet. Text is near-black (`#111111`) rather than true black, creating micro-contrast softness throughout. The combination reads like a well-printed book: easy on the eyes, typographically confident.

The defining visual choice is the serif/sans pairing. Playfair Display commands headlines and the logotype — its high-contrast strokes, elegantly curved letters, and optical authority make large type feel editorial and premium. Inter handles all UI copy, captions, and navigation: geometric, neutral, and highly legible at every size. JetBrains Mono serves code and terminal output. Together, these three families create a clear register system: headlines announce, body explains, code instructs.

The hero title is the emotional centerpiece. "Architect" is rendered letter-by-letter, each character assigned a color from one of five rotating palettes (default-random, rainbow, cool, hot, outline). The chosen palette rotates each visit (stored in localStorage) so returning users encounter something different without randomness feeling arbitrary. This is the only place where color escapes the achromatic system — everywhere else, color is strictly functional.

**Key Characteristics:**
- Cream canvas (`#fcfcfb`) with near-black (`#111111`) text — warmth before contrast
- Playfair Display (serif) for headlines and logotype; Inter (sans) for UI; JetBrains Mono for code
- `--tracking-tightest: -0.04em` on the hero title — the only aggressive letter-spacing in the system
- Full-pill buttons (`rounded-full`) as the primary interactive shape — circles and pills, never square
- Surface gray (`#f3f2ef`) as the secondary background layer — cards, code blocks, tag backgrounds
- Hero wordmark: five rotating palettes with per-letter color assignment, localStorage-persisted
- Selection inversion: selected text renders dark-on-cream to light-on-dark
- Font smoothing (`antialiased`) applied globally

## 2. Color Palette & Roles

### Core
- **Cream** (`#fcfcfb`): Page background, primary canvas. Not pure white — the warmth is intentional.
- **Dark** (`#111111`): Primary text, headings, dark button backgrounds. Not pure black.
- **Muted** (`#8c8c8c`): Secondary text, captions, hover state for nav links, trailing arrows.
- **Surface** (`#f3f2ef`): Subtle background layer for cards, code blocks, secondary buttons.

### Grays (Tailwind utilities)
- `gray-800` (`#1f2937`): Hover state for dark buttons.
- `gray-700` (`#374151`): Deep gray where used.
- `gray-600` (`#4b5563`): Secondary text alternative.
- `gray-300` (`#d1d5db`): Light borders and dividers.
- `gray-200` (`#e5e7eb`): Card borders, hover state for surface buttons.
- `gray-100` (`#f3f4f6`): Near-surface alternate.

### Hero Palette Accents (Hero only — not used in UI chrome)
These colors appear exclusively in the Hero wordmark, never decoratively elsewhere.

| Palette | Letters | Colors |
|---------|---------|--------|
| default-random | A,r,c,h,i,t,e,c,t | `#FF5E1A`, `#2B4FE8`, `#A020F0`, `#22C55E`, `#FF5E1A`, `#0EA5E9`, `#FACC15`, `#FF5E1A`, `#2DD4BF` |
| rainbow | A,r,c,h,i,t,e,c,t | `#FF5E1A`, `#F97316`, `#FACC15`, `#22C55E`, `#06B6D4`, `#3B82F6`, `#8B5CF6`, `#EC4899`, `#14B8A6` |
| cool | A,r,c,h,i,t,e,c,t | `#2DD4BF`, `#38BDF8`, `#10B981`, `#3B82F6`, `#14B8A6`, `#0EA5E9`, `#06B6D4`, `#22C55E`, `#2563EB` |
| hot | A,r,c,h,i,t,e,c,t | `#F97316`, `#B45309`, `#EF4444`, `#DC2626`, `#C2410C`, `#F59E0B`, `#991B1B`, `#FB7185`, `#EA580C` |
| outline | All | `transparent` fill + `1.5px #111111` `-webkit-text-stroke` |

### Terminal / Code Colors
- **Green 400** (`#4ade80`): Terminal success output, simulated stdout.
- **Gray 300** (`#d1d5db`): Terminal body text on dark backgrounds.
- **Emerald 600** (`#059669`): Checkmarks, success indicators in comparison tables.

### Interactive & Semantic
- No explicit focus ring color token — relies on browser defaults.
- Link style: `.underline underline-offset-2` with `hover:text-muted` transition.

### Selection
- Background: `#111111` (dark)
- Text: `#fcfcfb` (cream)
- Inverts the base scheme — reinforces the two-tone identity even in selection.

## 3. Typography Rules

### Font Families

| Token | Font | Fallbacks | Use |
|-------|------|-----------|-----|
| `--font-sans` | Inter | `ui-sans-serif, system-ui, sans-serif` | Body, UI, nav, buttons |
| `--font-serif` | Playfair Display | `ui-serif, Georgia, serif` | Headlines, logotype, section headings |
| `--font-mono` | JetBrains Mono | `ui-monospace, SFMono-Regular, monospace` | Code blocks, terminal, install command |

Imported weights: Inter 400/500/600; Playfair Display 400/500/600 (normal + italic); JetBrains Mono 400/500.

### Letter Spacing

| Token | Value | Use |
|-------|-------|-----|
| `--tracking-tightest` | `-0.04em` | Hero title only |
| `tracking-tight` | `-0.025em` (Tailwind) | Navbar logotype |
| `normal` | `0em` | All other text |

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Hero Wordmark | Playfair Display | 96px (text-8xl) | default | 1 (leading-none) | -0.04em | Per-letter color; responsive to 60px on mobile |
| Hero Subheading | Playfair Display | 48px (text-5xl) | default | tight | normal | Responsive to 30px mobile |
| Hero Body | Inter | 20px (text-xl) | 400 | relaxed | normal | Centered, max-w-2xl |
| Section Heading | Playfair Display | 30px (text-3xl) | 600 | tight | normal | Used in HowItWorks, Quickstart |
| Card Title | Inter | 18px (text-lg) | 600 | tight | normal | Feature card headings |
| Body / Description | Inter | 16px (base) | 400 | normal | normal | Standard reading text |
| Nav Links | Inter | 14px (text-sm) | 500 | — | normal | Horizontal nav |
| Button Label | Inter | 14px (text-sm) | 500 | — | normal | All buttons |
| Code / Terminal | JetBrains Mono | 14px (text-sm) | 400–500 | normal | normal | Inline and block code |
| Inline Code | JetBrains Mono | 14px (text-sm) | 400 | — | normal | `bg-surface px-1.5 py-0.5 rounded` |
| Docs h1 | Playfair Display | 30px (text-3xl) | 600 | — | normal | Top-of-page heading |
| Docs h2 | Playfair Display | 20px (text-xl) | 600 | — | normal | Section headings in docs |
| Docs h3 | Inter | 16px (base) | 600 | — | normal | Sub-headings in docs |
| Docs body | Inter | base | 400 | 1.75 (leading-7) | normal | Readable prose |

### Principles
- **Serif for announcement, sans for function**: Playfair Display carries emotional weight at large sizes. Inter never competes — it recedes into legibility.
- **Three weights only**: 400 (reading), 500 (UI/interaction), 600 (headings/emphasis). Nothing heavier.
- **Tracking discipline**: `-0.04em` appears only on the hero wordmark. Everything else is normal or `tracking-tight` for the logotype only. Unlike Vercel's aggressive per-size tracking system, this UI treats letter-spacing as a single deliberate accent.
- **Italic as accent**: Playfair Display italic is available but used sparingly — the italic cut is distinct and should land only when truly needed.
- **Mono for developer voice**: JetBrains Mono signals "this is the tool speaking" — install commands, code blocks, terminal simulation.

## 4. Component Stylings

### Buttons

**Primary Dark (CTA)**
- Background: `bg-dark` (`#111111`)
- Text: `text-white`
- Padding: `px-8 py-3.5`
- Radius: `rounded-full` (9999px)
- Hover: `hover:bg-gray-800`
- Transition: `transition-colors`
- Use: Primary actions ("Get Started", "GitHub")

**Secondary Surface**
- Background: `bg-surface` (`#f3f2ef`)
- Text: `text-dark`
- Padding: `px-8 py-3.5`
- Radius: `rounded-full`
- Hover: `hover:bg-gray-200`
- Transition: `transition-colors`
- Use: Secondary actions ("Read the Docs")

**GitHub Nav Button**
- Same as Primary Dark + inline SVG GitHub icon (`w-4 h-4`)
- Padding: `px-5 py-2.5`
- Use: Global nav CTA

### Cards & Containers

**Standard Card**
- Background: `bg-white`
- Border: `border border-gray-200`
- Radius: `rounded-3xl` (24px)
- Shadow: `shadow-sm`
- Padding: `p-8`
- Use: Feature cards, HowItWorks steps, comparison items

**Terminal / Code Block**
- Background: `#0a0a0a` (near-black)
- Border: `border border-gray-800`
- Radius: `rounded-2xl` (16px)
- Shadow: `shadow-2xl`
- Text: `text-green-400` (output), `text-gray-300` (body)
- Use: Quickstart terminal simulation

**Docs Content Area**
- Background: `bg-white`
- Padding: `p-8`
- Border: `border-r border-gray-200` on sidebar
- Use: Docs layout panels

### Inline Code
- Background: `bg-surface`
- Padding: `px-1.5 py-0.5`
- Radius: `rounded`
- Font: `font-mono text-sm`

### Pre / Code Blocks
- Background: `bg-surface`
- Radius: `rounded-lg`
- Padding: `p-4`
- Overflow: `overflow-x-auto`
- Syntax highlight: GitHub light theme via `highlight.js/styles/github.css`

### Navigation

**Global Navbar**
- Container: `px-6` outer, `max-w-280 mx-auto`
- Layout: `flex items-center justify-between py-6`
- Logotype: `font-serif text-2xl font-semibold tracking-tight`
- Nav links: `hidden md:flex`, `text-sm font-medium`, `text-dark hover:text-muted transition-colors`
- GitHub CTA: Primary Dark button, `gap-2`, SVG icon
- Mobile: Nav links hidden below `md` breakpoint

**Docs Sidebar**
- Width: fixed, sticky
- Section labels: uppercase, small, muted
- Links: base size, hover with color change
- Active state: darker text or semibold

**Docs Right TOC**
- Hidden below `lg`
- Sticky scrollspy
- Level 3 headings indented

### Install Command
- Monospace font, surface background
- Copy-to-clipboard button with feedback state

### Marquee Carousel (BuiltInSkills)
- Continuous horizontal scroll via `marquee-left` / `marquee-right` keyframes
- Pause on hover (CSS `animation-play-state`)
- Grayscale icon grid; two opposing rows for visual depth

## 5. Layout Principles

### Spacing System

Base unit: 4px (Tailwind default). Common values:

| Token | px | Use |
|-------|----|-----|
| `gap-2` | 8px | Tight inline gaps |
| `gap-4` | 16px | Standard inline spacing |
| `gap-6` | 24px | Medium component gaps |
| `gap-8` | 32px | Section-internal spacing |
| `gap-10` | 40px | Large gaps between groups |
| `gap-12` | 48px | Between major sub-sections |
| `gap-16` | 64px | Between major grid items |
| `gap-20` | 80px | Wide landmark spacing |
| `py-12` | 48px | Compact section padding |
| `py-24` | 96px | Standard section padding |
| `py-32` | 128px | Full-bleed sections |
| `pt-32 pb-24` | 128/96px | Hero vertical rhythm |

### Grid & Container

- **Max content width**: `max-w-280` — approximately 1120px, used consistently across all sections
- **Hero**: `max-w-5xl` centered, `text-center` layout
- **Section grids**: 2–3 column responsive grids for cards (`md:grid-cols-2`, `lg:grid-cols-3`)
- **Docs layout**: 3-panel — left sidebar + main content + right TOC, collapses to single column on mobile
- **Horizontal padding**: `px-6` at the page level throughout

### Whitespace Philosophy

Large vertical padding between sections (96px–128px) makes structure legible without borders or background color changes. Sections are white-on-cream — separation comes from spacing, not color. The generous whitespace communicates confidence: nothing is crammed, nothing begs for attention.

### Border Radius Scale

| Size | Value | Use |
|------|-------|-----|
| `rounded` | 4px | Inline code, small tags |
| `rounded-lg` | 8px | Pre blocks, small containers |
| `rounded-2xl` | 16px | Terminal cards, code blocks |
| `rounded-3xl` | 24px | Feature cards, standard cards |
| `rounded-4xl` | 32px | Large hero containers |
| `rounded-full` | 9999px | All buttons, pill badges |

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (0) | No shadow | Page background, prose text |
| Subtle (1) | `shadow-sm` | Standard cards, list items |
| Elevated (2) | `shadow-lg` | Sidebar panels, modal-adjacent |
| Prominent (3) | `shadow-2xl` | Terminal/code blocks, hero elements |

**Philosophy**: Shadows indicate surface layer, not importance. Cards are subtle — `shadow-sm` is the default. Only the terminal simulation uses `shadow-2xl` because it's meant to look like a lifted, physical object in contrast to the flat surrounding layout. There is no border-as-shadow technique here — cards use explicit `border border-gray-200`.

### Decorative Depth
- No gradient backgrounds in sections — depth comes from spacing and shadow
- Terminal block uses dark background (`#0a0a0a`) for maximum contrast with cream canvas
- Marquee rows at different speeds create perceived depth in the BuiltInSkills section

## 7. Animation & Motion

### Keyframes (globals.css)

```css
@keyframes marquee-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes marquee-right {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}
```

Both use GPU-composited `transform` — no layout recalc. `-50%` assumes the list is duplicated so the animation loops seamlessly.

### Hover Transitions
- All interactive elements use `transition-colors` — color only, no geometry.
- Duration: Tailwind default (150ms).
- No scale transforms, no position shifts on hover.

### Hero Wordmark
- Fades in on mount: `opacity-0` → `opacity-100` with `duration-150` once style index is resolved from localStorage.
- Prevents flash of unstyled/wrong-color text before hydration.

## 8. Docs Content Styling (DocsMarkdown)

The docs renderer applies prose styles manually via React component mapping:

| Element | Classes |
|---------|---------|
| `h1` | `font-serif text-3xl font-semibold mt-2 mb-6` |
| `h2` | `font-serif text-xl font-semibold mt-10 mb-3` |
| `h3` | `font-sans text-base font-semibold mt-6 mb-2` |
| `p` | `text-dark leading-7 mb-4` |
| `a` | `underline underline-offset-2 hover:text-muted transition-colors` |
| `ul` | `list-disc pl-6 mb-4 space-y-1` |
| `ol` | `list-decimal pl-6 mb-4 space-y-1` |
| `li` | `text-dark leading-7` |
| `code` (inline) | `font-mono text-sm bg-surface px-1.5 py-0.5 rounded` |
| `pre` | `bg-surface rounded-lg p-4 overflow-x-auto mb-4 shadow-sm` |
| `blockquote` | `border-l-4 border-gray-300 pl-4 italic text-muted mb-4` |
| `table` | `w-full border-collapse mb-4 text-sm` |
| `thead` | `bg-surface` |
| `th` | `border border-gray-200 px-3 py-2 text-left font-semibold` |
| `td` | `border border-gray-200 px-3 py-2` |

## 9. Responsive Behavior

### Breakpoints (Tailwind defaults)

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | < 640px | Stacked layout, full-width buttons, nav links hidden |
| sm | 640px | Buttons go `flex-row`, side-by-side CTAs |
| md | 768px | Nav links appear, 2-column grids begin |
| lg | 1024px | Docs right TOC visible, 3-column grids |
| xl | 1280px | Full desktop layout |

### Key Responsive Patterns

- **Hero title**: `text-6xl md:text-8xl` — 60px mobile, 96px desktop
- **Hero subheading**: `text-3xl md:text-5xl` — scales with title
- **Hero body**: `text-lg md:text-xl` — 18px mobile, 20px desktop
- **CTA buttons**: `flex-col sm:flex-row`, `w-full sm:w-auto` — stacked on mobile, inline on sm+
- **Navigation links**: `hidden md:flex` — hamburger-free collapse (links just hide)
- **Docs sidebar**: `hidden md:block` — collapses off-screen below md
- **Docs TOC**: `hidden lg:block` — three-column docs collapses to two then one

### Collapsing Strategy
- Hero: font size scales, tracking and leading preserved
- Buttons: full-width stack → inline pill row
- Nav: links hidden, GitHub CTA always visible
- Cards: 3-col → 2-col → 1-col
- Docs: sidebar + TOC → sidebar only → single column

## 10. Do's and Don'ts

### Do
- Use `#fcfcfb` cream (not `#ffffff` white) for page backgrounds
- Use `rounded-full` for all buttons and pill shapes — the circle/pill is the primary interactive shape
- Use Playfair Display for headings and the logotype only
- Use Inter for all body, UI, and navigation text
- Use `shadow-sm` on cards — elevation should be minimal and unobtrusive
- Apply `-0.04em` letter spacing (`tracking-tightest`) only to the hero wordmark title
- Keep hero accent colors (rainbow, hot, cool palettes) in the Hero component only
- Use `bg-surface` (`#f3f2ef`) for subtle backgrounds — code blocks, secondary buttons, inline code

### Don't
- Don't use `#ffffff` pure white as the page background — cream is the base
- Don't use `rounded-lg` or `rounded-xl` for buttons — they are always `rounded-full`
- Don't apply Playfair Display to body text or UI labels — its high contrast strokes become distracting at small sizes
- Don't use color decoratively in the UI chrome — color is reserved for the Hero wordmark
- Don't use shadows heavier than `shadow-lg` except in the terminal simulation block
- Don't apply negative letter-spacing outside the hero title
- Don't introduce new font families — three families (serif/sans/mono) is the full system
- Don't use `border-none` on cards — cards always have `border border-gray-200`
- Don't stack accent colors outside the Hero — no orange/purple/teal in section headings, badges, or UI elements

## 11. Agent Prompt Guide

### Quick Color Reference
- Page background: `#fcfcfb` (cream)
- Primary text: `#111111` (near-black)
- Secondary text: `#8c8c8c` (muted)
- Subtle surface: `#f3f2ef`
- Card border: `border-gray-200` (`#e5e7eb`)
- Primary CTA background: `#111111`

### Example Component Prompts

**Hero section:**
"Cream background (`#fcfcfb`). Large serif title at 96px Playfair Display, `leading-none`, `tracking-tightest` (`-0.04em`), per-letter inline colors. Serif subheading at 48px, normal tracking, `leading-tight`. Body text at 20px Inter weight 400, `#8c8c8c`, `leading-relaxed`, centered, `max-w-2xl`. Two pill CTA buttons: primary `bg-dark text-white`, secondary `bg-surface text-dark`, both `px-8 py-3.5 rounded-full`."

**Feature card:**
"White background, `border border-gray-200`, `rounded-3xl`, `shadow-sm`, `p-8`. Card title: 18px Inter weight 600, `#111111`. Description: 16px Inter weight 400, `#8c8c8c`. Bullet list with dot markers."

**Terminal block:**
"Background `#0a0a0a`, `border border-gray-800`, `rounded-2xl`, `shadow-2xl`. Prompt text: `font-mono text-sm text-green-400`. Body text: `text-gray-300`."

**Navigation:**
"Sticky white nav (background `#fcfcfb`). Logo: `font-serif text-2xl font-semibold tracking-tight`. Links: `text-sm font-medium text-dark hover:text-muted transition-colors`. Right CTA: `bg-dark text-white px-5 py-2.5 rounded-full text-sm font-medium` with GitHub SVG icon."

**Docs prose:**
"Section heading: `font-serif text-xl font-semibold`. Body: `text-dark leading-7`. Inline code: `font-mono text-sm bg-surface px-1.5 py-0.5 rounded`. Pre block: `bg-surface rounded-lg p-4 shadow-sm`."
