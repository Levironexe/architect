# Architect UI

Architect UI is the Next.js App Router surface for composing stack selections into an AI-ready design pack workflow. The current baseline is a dark editorial shell centered on one command-first module rather than a live markdown preview.

## Current Product Baseline

- The home page is a command-first experience: users select a compatible stack and receive a single `npx` command to run from their project root.
- Invalid or incompatible selections never show a misleading command. The page keeps users in-flow with corrective guidance and degraded-URL notices.
- The visual system uses a reusable editorial baseline defined through shared tokens in `app/globals.css` and layout primitives in `src/components/EditorialShell.tsx`, `src/components/SectionEyebrow.tsx`, and `src/components/UsageModule.tsx`.

## Key Implementation Surfaces

- `app/page.tsx`: page composition, hero shell, and command-first layout wiring
- `app/globals.css`: editorial design tokens, typography stacks, and reusable surface rules
- `src/hooks/useComposer.ts`: URL-backed selection state, warning/notice handling, and usage-module state
- `src/lib/download-command.ts`: deterministic command serialization and blocked-state logic
- `src/components/StackPicker.tsx`: stack selection controls and compatibility messaging
- `src/components/UsageModule.tsx`: command display, copy interaction, and fallback guidance

## Getting Started

```bash
cd ui
npm install
npm run dev
```

Open `http://localhost:3000` to interact with the command-first stack composer.

## Validation

```bash
cd ui
npm test
npm run lint
npm run build
```

## Extending The Baseline

- Reuse `EditorialShell` for future hero-and-module layouts.
- Reuse `SectionEyebrow` for metadata rails and section labels.
- Reuse `UsageModule` when a future surface needs the same command-first delivery pattern.
- Keep new surfaces on the same token vocabulary in `app/globals.css` instead of introducing page-local color or radius values.
