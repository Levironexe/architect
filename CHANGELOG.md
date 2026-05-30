# Changelog

All notable changes to Architect CLI are recorded here.

## 0.7.10

### Added

- **`auth_mechanism_mismatch` anti-pattern** (critical) — detects when login uses one auth mechanism but API guards check a different one. Added to Next.js, React SPA, Express, Django skills.

### Improved

- **Oversized file gate strengthened** — refactor skill now checks BOTH the source page AND the extracted component. Relocating a 730 LOC file to a 730 LOC component is explicitly called out as "renaming, not splitting."
- **Plan requires named sub-components** — when splitting an oversized file, the plan must list concrete sub-component names with target LOC estimates. No more vague "extract to component" steps.
- **Dead code sweep in final check** — refactor skill now greps for unused state declarations, duplicated utility functions, and leftover console.log before declaring done.
- **Auth consistency check in final check** — refactor skill verifies that login flow produces tokens compatible with API auth guards. Flags mismatches that would cause all authenticated requests to fail.

## 0.7.9

### Added

- **Security and architecture dimensions in health score** — score now includes 4 dimensions:
  - Modularity (35%): file sizes, function complexity
  - Duplication (20%): jscpd duplicate detection
  - Security (25%): hardcoded secrets, missing auth guards, weak crypto
  - Architecture (20%): circular dependencies, severe hub files, dead code
- **`architect verify --strict`** — fails verification on circular dep increase, duplication increase >1%, or health regression. Refactor skill template now uses `--strict` by default.

### Fixed

- **Test file false positives** — `password="testpass123"` in test files no longer flagged as CRITICAL. Test files (`tests/`, `__tests__/`, `*.test.*`, `*_test.*`, `conftest.py`, `factories.*`) downgraded to INFO severity for hardcoded credential patterns.
- **Security penalty removed from ad-hoc calculation** — security now scored as a proper dimension instead of subtracting `criticalCount * 5` from the overall.

## 0.7.8

### Added

- **`architect verify` for Python, C#, and Java** — language-specific compilation checks:
  - Python: `mypy` type check (if installed), falls back to `py_compile` syntax check
  - C#: `dotnet build` compilation check
  - Java: auto-detects Maven (`mvn compile`) or Gradle (`gradle compileJava`)
  - All gracefully skip if the build tool is not installed
- Broken import detection now correctly limited to JS/TS only (Python relative imports no longer produce false positives)

## 0.7.7

### Added

- **31 new anti-patterns across 34 skills** — addresses gaps found during real refactoring audits:
  - `oversized_extraction` added to all 12 stack skills + 4 data layer patterns — flags extracted modules that are still 300+ LOC (moved the god file, didn't split it)
  - `alert_for_errors` added to 3 frontend stacks (Next.js, React SPA, Vue/Nuxt) — flags `alert()` usage for error display
  - `direct_db_in_route` added to Next.js — flags Prisma calls in API route handlers (not just pages)
  - `notification_in_model` added to Django — flags email/SMS dispatch from model methods
  - `untested_abstractions` added to Vitest — flags new services/repos created without tests
  - `auth_logic_in_component` / `auth_check_scattered` added to NextAuth, Clerk, Supabase Auth — flags decentralized auth checks
  - `oversized_repository` / `oversized_model_file` added to Prisma, Drizzle, Mongoose, Supabase — flags bloated data access files

### Fixed

- **`architect diff` phase sort bug** — `phase-10.json` was sorting before `phase-2.json` alphabetically. Now uses numeric sort. Diff correctly compares baseline with the actual latest phase.
- **Health score delta color** — `+25` health improvement was showing red (bad). Now correctly shows green for health score increases.

### Improved

- **Practical audit prompt** — `docs/AUDIT_PROMPT.md` replaced score-based audit with 7 practical engineering questions (Organization, Coupling, Consistency, Security, Error Handling, Testability, Modularity) with concrete grep/find commands and evidence-based verdicts.

## 0.7.6

### Added

- **`architect scan --summary`** — compact output showing only health score, critical/warning issues, and one-line metrics. Useful for large projects where full scan floods the terminal.

### Fixed

- **Stack detector priority bug** — `react-spa` was incorrectly winning over `nextjs-app-router` despite lower score. Sort now correctly orders: stack → pattern → meta. Projects with `next.config` + `app/` directory now correctly detect as Next.js App Router.
- **`state.json` health tracking** — refactor skill template now has stronger instructions to read `health_score` from the actual scan file instead of estimating. Includes concrete example and CRITICAL label.

### Improved

- **Refactor skill execution quality** — added 3 new post-phase quality gates:
  - *Extraction completeness*: greps for extracted functions in original location, deletes if still there
  - *Abstraction adoption*: verifies new abstractions (NotificationService, PaymentGateway) have at least one caller
  - *Signal replacement*: verifies signals.py no longer contains business logic after cleanup phase
- **Anti-regression rules** — refactor skill now refuses to mark steps complete if: original method still exists after extraction, signals still contain business logic, or abstractions are created but unused
- **Plan-completion audit** — refactor skill re-reads every phase Goal at the end and surfaces any unmet promises as known gaps

## 0.7.5

### Fixed

- **Templates use `architect` instead of `npx @levironexe/architect`** — prevents stale version resolution via local `node_modules`. All three skill templates updated.

## 0.7.4

### Fixed

- **Removed self-dependency pinning npx to v0.5.0** — package.json listed itself as a dependency at `^0.5.0`, causing `npx @levironexe/architect` to resolve to the stale local copy instead of the globally installed version. Root cause of blank baselines in all non-JS projects.

## 0.7.3

### Fixed

- **Django projects detected via `manage.py`** — projects without `requirements.txt` were undetected, causing scan to default to JS/TS and return 0 files. Root cause of blank baselines.
- **Added `setup.cfg`** to Python config file detection.
- **Added `settings.gradle` / `settings.gradle.kts`** to Java config file detection for multi-module Gradle projects.

## 0.7.2

### Fixed

- **Blank snapshots warn instead of skipping** — `scan --snapshot` and `verify --phase N` now save the file even when 0 files found, but emit a loud WARN so the agent knows to fix the root cause.
- **Stale baseline warning** — `verify` warns when baseline has 0 files, preventing misleading health deltas.

## 0.7.1

### Fixed

- **Health scoring rebalanced** — modularity now weighted 65% (was 50%), duplication 35%. Refactored projects no longer score worse than their monolithic originals due to intermediate duplication.
- **Duplication curve softened** — >30% duplication scores 45 (was 10), new bracket at 35-50% (score 30). Prevents cliff-drop scoring.
- **Modularity penalty strengthened** — oversized file penalty uses both ratio and absolute count, with higher caps. 17 god files now properly tanks the score.

## 0.7.0

### Added

- **Full scan for Python, C#, and Java** — tree-sitter WASM-based AST parsing extracts functions, classes, imports, exports, and cyclomatic complexity for all three languages, achieving parity with JS/TS full scan.
- **Import-based dependency graph** — `buildDependencyGraphFromImports()` builds dependency graphs from import/using/import statements for non-JS languages (replaces madge which is JS-only).
- **Circular dependency detection** — DFS-based cycle detection works for all languages via the import graph.
- **Graceful WASM fallback** — if tree-sitter initialization fails, scan automatically falls back to lite scan instead of crashing.
- **Performance guard** — warns when >5000 files are discovered before scan begins.

### Changed

- Python, C#, Java configs upgraded from `supportsScanning: 'lite'` to `supportsScanning: 'full'`.
- Language detection in terminal reporter now recognizes Python, C#, and Java files.
- Modularity scoring, dead code analysis, and dependency insights now work for all supported languages.

## 0.6.1

### Fixed

- **Stack detection for non-JS/TS** — `collectProjectCharacteristicsFromLanguage` now collects project files (`.json`, `.csproj`, `.sln`) and reads source text, fixing false detection (e.g., MVC detected instead of Web API).

### Changed

- **Plan template: anti-patterns injected** — `/architect-plan` now includes the stack's anti-patterns with bad/good examples, so the agent knows exactly what to look for.
- **Plan template: security findings injected** — static scan security findings listed in the skill context.
- **Plan template: scan tier disclaimer** — for lite scans, the agent is told not to trust the static score and to assess architecture itself.
- **Plan template: Step 4b (Score the architecture)** — agent rates separation, dependency direction, abstraction quality, security, and organization 1-5, gives overall 1-10.
- **Plan template: language-agnostic** — Step 1 references `.csproj`, `pom.xml`, `pyproject.toml`, etc., not just `package.json`.

## 0.6.0

### Added

- **Multi-language scanning (lite scan)** — `architect scan` now works for Python, C#, and Java projects, not just JS/TS.
- **Lite scan metrics** — file count, LOC per file, duplication % (jscpd), security findings, file-size distribution score, and health score for all 4 languages.
- **Language-aware line counter** — correctly handles `#` (Python), `//` (C#/Java/JS), `/* */` and `"""` block comments.
- **File-size distribution score** — replaces modularity score for non-JS/TS (penalizes god files, high avg LOC, single-file dominance).
- **Language-specific security patterns** — Python: `hashlib.md5`, `pickle.loads`, `eval/exec`. C#: `MD5.Create`, `SHA1.Create`. Java: `MessageDigest.getInstance("MD5")`, `Runtime.exec`.
- **Scan tier tracking** — `scanTier: 'lite' | 'full'` on scan results and snapshots.
- **Language-aware verify** — `architect verify` skips tsc/import checks for non-JS/TS projects.

### Changed

- `LanguageConfig.supportsScanning` changed from `boolean` to `false | 'lite' | 'full'`.
- Python, C#, Java configs now have `supportsScanning: 'lite'` (was `false`).
- File walker accepts dynamic extensions per language (was hardcoded JS/TS).
- Duplication analyzer excludes language-specific build dirs (`__pycache__`, `venv`, `obj`, `target`, `.gradle`).
- Security scanner skips `#` comment lines for Python files.
- `isApiRouteFile` now matches Python views/routes, C# Controllers, Java Controllers/Resources.
- Error messages are language-aware ("No source files found" instead of "No JS/TS files found").

## 0.5.0

### Added

- Multi-language project detection — Python (pyproject.toml, requirements.txt, setup.py, Pipfile), C# (.csproj), Java (pom.xml, build.gradle).
- Language registry system (`src/languages/`) — extensible config per language with dependency parsers.
- Pattern-as-primary detection — pattern skills (Selenium, Playwright, etc.) can be primary when no stack matches.
- 9 new language-specific pattern skills:
  - `selenium-csharp`, `selenium-python`, `selenium-java` — Selenium E2E with POM, driver factory, explicit waits.
  - `playwright-csharp`, `playwright-python`, `playwright-java` — Playwright E2E with POM, auth fixtures.
  - `s3-python`, `s3-csharp`, `s3-java` — AWS S3 with presigned URLs, client singleton, upload confirmation.
- Java language support — Maven (pom.xml) and Gradle (build.gradle, build.gradle.kts) dependency parsing.

### Changed

- `docker-deploy` skill relabeled from `language: javascript` to `language: agnostic`.
- `architect init` now detects language first, skips scanning for non-JS/TS projects.
- README updated with 4 supported languages and all 35 skills listed.
- Total skills: 35 (12 stacks + 22 patterns + 1 meta) across 4 languages.

## 0.4.0

### Added

- `architect diff` command — compare scan snapshots for before/after metrics.
- `architect status` command — show refactoring phase progress from state.json.
- `architect verify` command — post-phase verification (tsc, broken imports, health delta).
- `architect scan --snapshot <path>` — save scan metrics as JSON snapshot.
- Security analyzer — hardcoded secrets, weak JWT fallbacks, MD5/SHA1, missing auth, multiple PrismaClient instances.
- Dead code analyzer — unreferenced files and exports.
- Service layer as first-class phase in plan template.
- Skill composition — integration-specific phases when multiple skills match (e.g., prisma + nextjs).
- State tracking — /architect-plan saves baseline snapshot and creates state.json.
- Verification in refactor loop — /architect-refactor runs verify after each phase.
- Scan diff in catchup — /architect-catchup shows before/after comparison.
- Resume support — /architect-refactor reads state.json to resume across sessions.
- Engineering principles coverage for all 22 skills (error handling, security, config, testability, SOLID, DRY, API contracts).
- `scripts/verify-phase.sh` — standalone bash wrapper for verification.

### Changed

- README updated with full skill list, new CLI commands, composition, and 9 principles.
- Plan template includes service layer and composed phase tokens.
- Refactor template uses verify instead of raw scan for phase checkpoints.
- Catchup template shows scan diff after re-scan.

## 0.3.1

- Improved init output format and always prompt for agent selection.

## 0.3.0

- Added architect-catchup skill, plan handoff prompt, and README cleanup.
- Improved scan accuracy, skill quality, and context auto-detect.

## 0.1.0

- Initial CLI scanning, dependency, duplication, skill detection, scoring, JSON output, and refactoring plan generation.
