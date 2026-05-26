---
name: architect-refactor
description: >
  Executes a refactoring plan phase by phase, moving files, updating imports, and pausing
  between phases for developer confirmation. Use this skill whenever the user wants to execute
  a refactor, apply an architect plan, move files per their architecture blueprint, or says
  "do the refactor", "execute phase 1", "start refactoring". Trigger even if the user just
  says "let's do it" after a planning session, or "go ahead with the plan".
metadata:
  version: "1.0"
  author-email: "levironforwork@gmail.com"
  last-updated: "2026-05-11"
---

# architect-refactor

You are executing a developer's refactoring plan one phase at a time. The goal is safe,
incremental restructuring  -  the developer controls the pace, you do the work precisely and
explain everything before you touch a file.

## Before you do anything: check for the plan

Look for `.architect/plan.md` in the project root.

If it does not exist, stop immediately and output:

```
❌ No refactoring plan found.

Run `/architect-plan` first to generate a plan, then invoke `/architect-refactor` to execute it.
```

Do not modify any files if the plan is missing.

## Architectural constraints you must follow

The following rules come from the **{{skill.name}}** architecture blueprint. Treat them as
hard constraints  -  they are not suggestions. Every file move you make must end up satisfying
these rules.

{{skill.separation.rules}}

If the above block is empty, use your best judgment based on the stack and the plan itself.

## Anti-patterns to avoid

After each step, verify you have not introduced any of the following:

{{skill.anti_patterns}}

If the above block is empty, at minimum: do not put business logic in route handlers, do not
hardcode secrets, do not create circular imports.

## How to execute the plan

### 1. Read the plan and check progress

Read `.architect/plan.md` in full.

If `.architect/state.json` exists, use it to determine where to resume:
- Parse the JSON and find the first phase with status `"pending"` or `"in_progress"`
- If a phase is `"in_progress"`, resume from its first unchecked step (`- [ ]`) in plan.md
- If all phases are `"completed"`, output "✅ All phases complete." and stop
- Set the found phase as your current target

If `.architect/state.json` does not exist, fall back to the checkbox method: look for the first
phase that still has unchecked steps (`- [ ]`). If all steps in a phase are already checked
(`- [x]`), skip to the next phase.

### 2. Execute the current phase, step by step

For each unchecked step in the current phase:

**Before touching the file**, state in the chat:
> "Step N.M: Moving `<source>` → `<target>`. Reason: <why from the plan>. Updating imports in: <files>."

Then:
1. Create the target directory if it doesn't exist
2. Move or create the file as specified
3. Update all imports listed in the step's "Imports to update" field, using the exact
   old-path → new-path substitutions specified (not just the file list)
4. If the step has a "Verify:" line, run the grep command it specifies. If it returns results,
   fix the remaining references before proceeding  -  do not mark the step done with known
   orphaned imports
5. Verify the project still makes sense (no obviously broken imports left behind)
6. Mark the step as done in `.architect/plan.md` by changing `- [ ]` to `- [x]`

If a step would create a circular dependency, skip it, explain why in the chat, and continue
with the next step.

### 3. After completing all steps in the phase, verify and update state

**MANDATORY**: Run verification after every phase  -  no exceptions. Do not skip this step.
```
architect verify . --phase N --strict
```
(Replace N with the current phase number.)

This creates `.architect/scans/phase-N.json` which is required for `architect diff` to work.
Every phase MUST have its own snapshot. If you skip verify, the diff comparison will be broken.

If the command is not available, fall back to:
```
architect scan .
```

**If verification FAILS** (exit code 1, or tsc errors / broken imports reported):
- Stop immediately
- Show the verification output to the developer
- Do not proceed to the next phase
- Output: "Phase N verification failed. Fix the issues above and run `/architect-refactor` to retry."

**If verification PASSES:**

Update `.architect/state.json` (if it exists):
- Set the current phase's `status` to `"completed"` and add `"completed_at": "<ISO timestamp>"`
- If a next phase exists, set its `status` to `"in_progress"` and `"started_at": "<ISO timestamp>"`
- Update `current_phase` to N+1
- **CRITICAL**: Read `.architect/scans/phase-N.json`, extract the `health_score` field, and set `latest_health` to that exact number. Do NOT estimate, round, or hardcode this value — it MUST match the scan file exactly. If the scan file shows `"health_score": 62`, then `latest_health` must be `62`.

Then output exactly this (replacing the placeholders):

```
✅ Phase N complete: <phase name>
Verification: PASSED (0 tsc errors, 0 broken imports)
Health: <baseline_health> → <latest_health> (+<delta>)

Steps executed:
- [x] Step N.1: <description>
- [x] Step N.2: <description>
...

Proceed to Phase N+1 (<next phase name>)? **yes / no**
```

**Post-phase quality gates** (check after every phase):

1. **Oversized files**: Read `.architect/scans/phase-N.json`. If `god_files > 0`, list them.
   If any oversized file was supposed to be split in this phase but is still >300 LOC, do NOT
   mark the phase complete — go back and finish splitting it.
2. **Duplication**: Compare `duplication_pct` from phase-N scan to baseline. If duplication
   increased by more than 1%, warn the developer and list the new duplicate blocks. Common
   cause: extracting logic to a service but leaving the original copy in the model/view.
3. **Cross-domain model methods**: If this phase extracted services, verify that model methods
   no longer call `send_mail`, create objects from other apps (e.g., `Invoice.objects.create`
   inside an `Appointment` method), or import from sibling apps. These must live in services.
4. **Extraction completeness**: For every "move X from A to B" or "extract X to B" step in this
   phase, grep for X in its original location A. If X still exists in A, you have a copy-paste
   extraction — DELETE the original. Do not leave duplicates. Example: if you extracted
   `generate_slots_for_week` from `models.py` to `services.py`, run
   `grep -n "generate_slots_for_week" models.py` — if it still defines the function, delete it.
5. **Abstraction adoption**: If this phase created an abstraction (e.g., `NotificationService`,
   `PaymentGateway`), verify at least ONE caller imports and uses it. An unused abstraction is
   worse than no abstraction — it creates the illusion of structure. Grep for its import across
   the codebase. If zero files import it, wire the most obvious caller before marking the phase done.
6. **Signal replacement**: If this phase was supposed to replace signals with explicit service
   calls, verify that `signals.py` no longer contains business logic. Acceptable signal content:
   simple field defaults (e.g., `auto_now_add`), profile creation on user save. Unacceptable:
   billing creation, email sending, state machine transitions, cross-app object creation.
   If signals.py still orchestrates business logic, the phase is NOT complete.

Then stop. Wait for the developer to respond before touching Phase N+1.

If there is no next phase, output:

```
✅ All phases complete.

The refactoring is done. Run `architect diff .` to see the full before/after comparison.
```

Then STOP. Do not make any further changes to the codebase. Proceed to step 5 below.

### 4. On developer confirmation

If the developer says yes (or "continue", "proceed", "go ahead"), execute the next phase
following the same step-by-step process.

If the developer says no (or "stop", "wait", "pause"), stop and confirm:
> "Paused after Phase N. The plan in `.architect/plan.md` is up to date  -  all completed steps
> are checked. Run `/architect-refactor` again when you're ready to continue."

### 5. After all phases complete: propose extra improvements (optional)

After the final phase is done and verified, review the codebase for improvements that were NOT
in the original plan  -  leftover duplication, old directories that should have been deleted,
naming inconsistencies, etc.

If you find potential fixes, propose them to the developer. Do NOT make any changes yet. Output:

```
💡 Found <N> potential improvements not covered by the plan:

1. <description of improvement>
2. <description of improvement>
...

Apply these as extra phases? **yes / no**
```

**If the developer says yes**, execute each improvement as an extra phase:
- Follow the same step-by-step process as regular phases
- After completing each extra phase, run verification:
  ```
  architect verify . --phase extra-N
  ```
  (This creates `extra-phase-N.json` in `.architect/scans/`)
- Wait for developer confirmation before proceeding to the next extra phase

**If the developer says no**, stop. Do not make any changes.

**If you find no improvements**, do not mention this step  -  just end with "All phases complete."

### 6. Final integrity check

Before declaring the refactoring done, verify these invariants:

1. **No oversized files remain**: Read the last phase scan. If `god_files > 0`, propose splitting
   them as extra phases.
2. **Duplication did not regress**: Compare last phase scan `duplication_pct` to baseline. If it
   increased, identify the duplicate blocks (usually old files left behind) and propose cleanup.
3. **state.json is accurate**: Read the last phase scan's `health_score` and confirm
   `latest_health` in state.json matches exactly. If not, fix it now.
4. **No orphaned old directories**: If the plan created per-app services/selectors, verify the
   old top-level `services/` directory was deleted. `find . -name "*.py" -path "*/services/*"`
   should only return app-level service files, not duplicates.
5. **Plan-completion audit**: Re-read `.architect/plan.md` from top to bottom. For each phase,
   re-read its **Goal** field and verify the goal was actually achieved in the codebase — not
   just that steps were checked off. Checking a step off means nothing if the underlying code
   change didn't stick. For each unmet goal, output:
   ```
   ⚠️ Known gap: Phase N goal "<goal>" was not fully achieved.
   Remaining issue: <what specifically is still wrong>
   ```
   This gives the developer an honest accounting of what the refactoring accomplished vs
   what was promised. Do not hide gaps — surface them.

## Important: what NOT to do

- Do not skip the pre-flight plan check  -  refactoring without a plan risks breaking the codebase
- Do not execute more than one phase per invocation unless the developer explicitly asks for all phases
- Do not modify files outside the scope of the current step
- Do not change business logic while moving files  -  the goal is structural change only
- Do not proceed to Phase N+1 automatically  -  always wait for the developer's yes/no
- Do not skip `architect verify . --phase N --strict` after ANY phase  -  this is mandatory, not optional
- Do not create snapshots with custom filenames (e.g., `final.json`, `after.json`)  -  only
  `architect verify --phase N` or `architect verify --phase extra-N` creates snapshots
- Do not make ANY changes after the final phase without proposing them to the developer first
- Do NOT mark a service extraction step complete if the original method/function still exists
  in the model or view. Extract means MOVE, not COPY. The old location must be cleaned.
- Do NOT mark a "replace signals" step complete if `signals.py` still contains business logic
  (billing, notifications, cross-app object creation). Only trivial signals are acceptable.
- Do NOT create an abstraction (NotificationService, PaymentGateway, etc.) without wiring at
  least one caller to use it. Unused abstractions are dead code that misleads future readers.
- Do NOT skip a step because it's "hard" or "risky" without telling the developer. If you
  decide a step is too dangerous, output: "⚠️ Skipping Step N.M: <reason>. This leaves a
  known gap: <what wasn't done>." The developer can then decide whether to proceed.
