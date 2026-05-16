# Changelog

All notable changes to Architect CLI are recorded here.

## Unreleased

### Added

- Interactive scan target prompting for human terminal sessions.
- Configurable scan thresholds for LOC and complexity findings.
- Explicit scan provider selection, including metrics-only mode.
- Human-only progress feedback for long-running analysis.
- Public documentation, contribution guide, issue templates, and CI workflow.

### Changed

- Expected scan errors now include clearer next actions.
- README now documents installation, command reference, scoring, providers, and example output.

### Fixed

- Machine-readable scan output remains free of prompts, spinners, and ANSI styling.

### Security

- Provider guidance avoids printing secret values and recommends environment-based configuration.

## 0.1.0

### Added

- Initial CLI scanning, dependency, duplication, skill detection, scoring, JSON output, and refactoring plan generation.
