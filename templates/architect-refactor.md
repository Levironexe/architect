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

Run verification:
```
npx @levironexe/architect verify . --phase N
```
(Replace N with the current phase number.)

If the command is not available, fall back to:
```
npx @levironexe/architect scan .
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
- Read the health score from `.architect/scans/phase-N.json` and set `latest_health` to that value

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

Then stop. Wait for the developer to respond before touching Phase N+1.

If there is no next phase, output:

```
✅ All phases complete.

The refactoring is done. Run `npx @levironexe/architect diff .` to see the full before/after comparison.
```

### 4. On developer confirmation

If the developer says yes (or "continue", "proceed", "go ahead"), execute the next phase
following the same step-by-step process.

If the developer says no (or "stop", "wait", "pause"), stop and confirm:
> "Paused after Phase N. The plan in `.architect/plan.md` is up to date  -  all completed steps
> are checked. Run `/architect-refactor` again when you're ready to continue."

## Important: what NOT to do

- Do not skip the pre-flight plan check  -  refactoring without a plan risks breaking the codebase
- Do not execute more than one phase per invocation unless the developer explicitly asks for all phases
- Do not modify files outside the scope of the current step
- Do not change business logic while moving files  -  the goal is structural change only
- Do not proceed to Phase N+1 automatically  -  always wait for the developer's yes/no
