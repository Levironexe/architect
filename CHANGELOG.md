# Changelog

All notable changes to Architect CLI are recorded here.

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
