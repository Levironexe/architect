# Plan Skill Enhancement: Fixing the 7/10 Gaps

**Date:** 2026-05-17
**Trigger:** Real-world test of `/architect-plan` on `nextjs-tasks` fixture. Refactor scored 7/10.
Three failures all trace to incomplete plan instructions, not wrong ones.

---

## 1. Current Template Analysis

### 1.1 What Works  -  Don't Break These

| Strength | Template Location |
|---|---|
| Phase ordering rules (hub files last, structural before extraction) | "Ordering rules" block in §5 |
| Step format: verb `source` → `target` + What/Why/Imports | Plan format spec in §5 |
| Risk labels per phase (low/medium/high) | Phase header format |
| "Independently executable" phase constraint | Ordering rules |
| Anti-pattern: don't change business logic while moving files | In architect-refactor.md |

The structural moves, phase sequencing, and line-number specificity were all correct in the test
output. The 7/10 score means the template's core framework is solid. Enhancements should be
targeted additions, not structural rewrites.

### 1.2 Structural Gaps  -  With Evidence

**Gap A  -  "Imports to update" is a file list, not a substitution spec**

Current template format:
```markdown
- Imports to update: <list files that import from source, or "none">
```

Generated plan output (Step 2.1):
```markdown
- Imports to update: `lib/db.ts`, `app/actions.ts`, `components/TaskBoard.tsx`, `components/TaskList.tsx`
```

`components/TaskBoard.tsx` was listed but line 4 still reads:
```typescript
import type { Project, ProjectSummary, Task, TaskStats } from '@/lib/db';
```
instead of `@/lib/types`. The refactor agent updated the action imports in that file but missed the
type imports because the instruction said "update the file" not "change import X to import Y."

A file list is ambiguous when a file has multiple imports affected differently by the same extraction.

**Gap B  -  Problem identification is example-based, not exhaustive**

Current template instruction:
> "Based on what you've read, identify the concrete structural problems"

No instruction to search exhaustively. The agent found `overdueTasks`, `urgentPending`, and
`completionRate` re-derivations in `page.tsx` but missed `recentlyDone`  -  same file, same pattern,
four lines below. Plan Step 5.1 mentioned three of the four instances; `recentlyDone` was never
in the plan and survived the refactor unchanged.

**Gap C  -  Destructive steps have no visibility separation from constructive steps**

Current template format allows arbitrary step ordering within a phase. Phase 4 had 8 steps:
- Steps 4.1–4.6: Extract new component files (constructive, high-visibility)
- Step 4.7: Delete `duplicateKpis` and `localCompletionRate` from `TaskBoard.tsx` (destructive, one sentence)
- Step 4.8: Update imports

The deletion was step 7 of 8 in a phase focused on extraction. Constructive steps produce visible
artifacts (new files); destructive steps produce absence. Agents are less reliable at tracking
deletions buried among creations.

**Gap D  -  No post-extraction verification instruction**

The template has no instruction to verify that the old import path has zero remaining references
after an extraction. After Step 2.1 extracted types from `lib/db.ts` to `lib/types.ts`, there was
no checkpoint to grep for remaining `@/lib/db` type imports. The orphaned import survived because
no verification was required.

---

## 2. Proposed Constraints

### Constraint 1  -  Import Substitution Spec (fixes Gap A)

**Name:** Import Substitution Rule

**What it says** (replace the current "Imports to update" format):

```
- Imports to update:
  - `<file>`: change `from '<old-module>'` → `from '<new-module>'` [for <symbol list>]
  - `<file2>`: no import change needed (re-exports from new location)
  - "none" if no consumers exist
```

**Where it goes:** Replace the existing `Imports to update: <list files>` in the plan format spec (§5).

**What failure it prevents:** Failure 1  -  agent can't selectively update wrong imports in a file
that has multiple unrelated imports. Specifying old-path → new-path removes ambiguity.

**Before (current output):**
```markdown
- Imports to update: `lib/db.ts`, `app/actions.ts`, `components/TaskBoard.tsx`
```

**After (with constraint):**
```markdown
- Imports to update:
  - `lib/db.ts`: remove the type exports (they now live in `lib/types.ts`)
  - `app/actions.ts`: change `from '@/lib/db'` → `from '@/lib/types'` for `Task`, `TaskStats`
  - `components/TaskBoard.tsx`: change `from '@/lib/db'` → `from '@/lib/types'` for `Task`, `Project`, `ProjectSummary`, `TaskStats`
```

---

### Constraint 2  -  Exhaustive Enumeration Before Writing Steps (fixes Gap B)

**Name:** Exhaustive Instance Rule

**What it says** (add to §4 "Identify the problems"):

> When you identify a problem pattern in a file, search for **all instances** of that pattern in
> that file before writing the plan step. Do not write "remove the X re-derivation"  -  write "remove
> all inline re-derivations in `<file>` that duplicate `lib/` output: `X` (line N), `Y` (line M),
> `Z` (line P)." If you find a pattern in one place, grep the file for similar constructs before
> moving on.

**Where it goes:** §4 "Identify the problems", as a new rule after the four bullet points.

**What failure it prevents:** Failure 2  -  `recentlyDone` was the same pattern as `urgentPending`
(inline filter on `tasks` array, result available from `lib/`), four lines away, never mentioned.

**Before (current plan Step 5.1):**
```markdown
- What: Delete `overdueTasks` filter (use `getOverdueTasks()` from `lib/db.ts` directly),
  `urgentPending` filter, and `completionRate` re-derivation
```

**After (with constraint):**
```markdown
- What: Remove all inline data derivations in `app/page.tsx` that duplicate outputs already
  available from `lib/`:
  - `completionRate` (line 8): use `stats.completionRate` already returned by `getTaskStats()`
  - `urgentPending` (line 12): move to `lib/` as `getUrgentPendingTasks()` or pass from `getOverdueTasks()` context
  - `recentlyDone` (lines 13–16): move to `lib/` as `getRecentlyDoneTasks(limit)` or compute in component
  - `overdueTasks` (was inline filter): already replaced by `getOverdueTasks()` in this phase
```

---

### Constraint 3  -  Dedicated Cleanup Phase for Destructive Actions (fixes Gap C)

**Name:** Cleanup Phase Rule

**What it says** (add to "Ordering rules" in §5):

> **Destructive steps** (deletions of dead code, removal of duplicate logic, deletion of deprecated
> patterns) must be collected into a dedicated final phase called "Cleanup: Remove Dead Code" rather
> than buried inside constructive phases. A constructive phase (extraction, creation, moving) should
> not contain deletion steps unless the deletion is the direct inverse of a creation in the same
> step (e.g., delete the original file after moving it).

**Where it goes:** "Ordering rules" block in §5, as a new rule after the four existing bullets.

**What failure it prevents:** Failure 3  -  Step 4.7 (delete `duplicateKpis`) was item 7 of 8
inside a phase focused on component extraction. Deletions produce absence; agents are more likely
to skip them when surrounded by louder constructive work.

**Before (current Phase 4 structure):**
```markdown
## Phase 4: Decompose TaskBoard.tsx
- Step 4.1: Extract TaskFilters.tsx
- Step 4.2: Extract TaskCard.tsx
- Step 4.3: Extract TaskDetailDrawer.tsx
- Step 4.4: Extract KanbanMirror.tsx
- Step 4.5: Extract SprintPlanner.tsx
- Step 4.6: Extract ProjectSidebar.tsx
- Step 4.7: Remove duplicate KPI derivation from TaskBoard.tsx  ← buried deletion
- Step 4.8: Update imports
```

**After (with constraint):**
```markdown
## Phase 4: Decompose TaskBoard.tsx
- Step 4.1: Extract TaskFilters.tsx
- Step 4.2: Extract TaskCard.tsx
- Step 4.3: Extract TaskDetailDrawer.tsx
- Step 4.4: Extract KanbanMirror.tsx
- Step 4.5: Extract SprintPlanner.tsx
- Step 4.6: Extract ProjectSidebar.tsx

## Phase N (final): Cleanup  -  Remove Dead Code
- Step N.1: Delete `localCompletionRate` and `duplicateKpis` from `TaskBoard.tsx` (lines 117–135)
  - What: Remove `const localCompletionRate = ...` and `const duplicateKpis = useMemo(...)`;
    update JSX references to use `stats.completionRate`, `stats.done`, `stats.highPriority`,
    `stats.overdue` from the prop passed by `page.tsx`
  - Why: Dead code  -  `page.tsx` already computes and passes `stats`
- Step N.2: Remove `urgentPending` and `recentlyDone` from `page.tsx` (lines 12–16)
  ...
```

---

### Constraint 4  -  Post-Extraction Verification (fixes Gap D)

**Name:** Consumer Verification Rule

**What it says** (add to §5 plan format, after Ordering rules):

> After every step that extracts code to a new module, add a verification note:
> ```
> - Verify: grep codebase for `from '<old-module>'`  -  should return zero files importing
>   the extracted symbols from the old location.
> ```
> This becomes an instruction to `/architect-refactor`: after executing the step, grep before
> marking it `[x]`.

**Where it goes:** §5 plan format spec, as an optional field on extraction/move steps.

**What failure it prevents:** Gap D  -  `components/TaskBoard.tsx` still imported types from
`@/lib/db` after Phase 2 because no verification required catching it.

**Before (current step format):**
```markdown
- [ ] Step 2.1: Extract TypeScript types into `lib/types.ts`
  - What: Move `Task`, `Project`, `Comment`, `TaskStats`, `ProjectSummary` type exports to `lib/types.ts`
  - Why: Types imported by components shouldn't drag in the DB connection
  - Imports to update: `lib/db.ts`, `app/actions.ts`, `components/TaskBoard.tsx`
```

**After (with constraint):**
```markdown
- [ ] Step 2.1: Extract TypeScript types into `lib/types.ts`
  - What: Move `Task`, `Project`, `Comment`, `TaskStats`, `ProjectSummary` type exports to `lib/types.ts`
  - Why: Types imported by components shouldn't drag in the DB connection
  - Imports to update:
    - `lib/db.ts`: re-export from `lib/types.ts` or remove type exports
    - `app/actions.ts`: change `from '@/lib/db'` → `from '@/lib/types'` for `Task`, `TaskStats`
    - `components/TaskBoard.tsx`: change `from '@/lib/db'` → `from '@/lib/types'` for `Task`, `Project`, `ProjectSummary`, `TaskStats`
    - `components/TaskList.tsx`: change `from '@/lib/db'` → `from '@/lib/types'` for `Task`
  - Verify: `grep -r "from '@/lib/db'" components/` should return zero type imports
```

---

## 3. Structural Changes to the Template

### 3.1 Update the step format spec (§5)

Replace the current `Imports to update` field format:

**Current:**
```
- Imports to update: <list files that import from source, or "none">
```

**New:**
```
- Imports to update:
  - `<file>`: change `from '<old>'` → `from '<new>'` for `<symbols>`
  - "none" if no consumers exist
- Verify: `grep -r "from '<old-module>'" <scope>/` should return zero results [extraction steps only]
```

### 3.2 Add Exhaustive Instance Rule to §4

Append after the existing four problem-identification bullets:

```markdown
When you find a problem pattern (e.g., "inline re-derivation of lib/ output in page.tsx"), grep
the file for all instances of that pattern before writing the plan step. List every instance by
name and line number in the step's "What" field. A step that says "remove X" when X, Y, and Z
are all instances of the same problem will leave Y and Z behind.
```

### 3.3 Add Cleanup Phase Rule to Ordering rules (§5)

Append as fifth ordering rule:

```markdown
- Collect all destructive actions (deleting dead code, removing duplicates, removing deprecated
  patterns) into a dedicated final phase labeled "Cleanup: Remove Dead Code." Do not embed
  deletions inside constructive phases  -  the absence of code is invisible and agents are prone
  to skipping embedded deletions when surrounded by creation steps.
```

### 3.4 Strengthen §4 with "look for both structural and semantic problems"

The template currently focuses on structural problems (wrong directories, mixed concerns). Inline
logic duplication (`urgentPending`, `recentlyDone`) is a semantic problem  -  code in the right
file but duplicating what `lib/` already provides. Add a fifth problem class to §4:

```markdown
- Where does this file re-derive data already computable from `lib/` functions? (inline filters,
  re-calculations, re-sorts that should be in a `lib/` function and called once)
```

---

## 4. Proposed Changes to architect-refactor.md

Minimal  -  one addition.

### 4.1 Add step verification before marking [x]

After step 4 ("Verify the project still makes sense") in "Execute the current phase", add:

```markdown
4b. If the step has a "Verify:" line, run the grep command it specifies. If it returns results,
    do not mark the step `[x]`  -  fix the remaining references first.
```

This closes the loop: the plan specifies what to verify, the refactor skill is instructed to
actually run the check. Without this addition, the "Verify:" lines in the plan are advisory, not
enforced.

---

## 5. Test Criteria

Re-run `/architect-plan` on `tests/fixtures/nextjs-tasks copy/` (the original messy fixture)
after applying the template enhancements. The regenerated `.architect/plan.md` should satisfy:

| Check | How to Verify |
|---|---|
| Import substitution spec | Every "Imports to update" entry specifies old-path → new-path and symbol list, not just a filename |
| `recentlyDone` in plan | Step 5.x (or equivalent) lists `recentlyDone` alongside `urgentPending`, `overdueTasks`, `completionRate` |
| Separate cleanup phase | Plan has a final phase titled "Cleanup" or "Remove Dead Code" containing deletion steps |
| Post-extraction verify | Steps that extract types or move modules include a "Verify: grep …" line |
| No deletions buried in constructive phases | No phase with "Extract X" steps also contains a "Delete Y" step |

After re-running `/architect-refactor` on the new plan, verify:
- `grep -r "from '@/lib/db'" components/` returns zero type imports
- `grep -n "urgentPending\|recentlyDone" app/page.tsx` returns zero results
- `grep -n "duplicateKpis\|localCompletionRate" components/TaskBoard.tsx` returns zero results
