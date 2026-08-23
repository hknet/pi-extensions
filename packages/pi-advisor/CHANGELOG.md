# Changelog

## 0.1.8 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Refine advisor tool guidance so non-trivial tasks require a review at an evidence-backed checkpoint before the final answer without encouraging an immediate first-action call.
- Make reviewer responses checkpoint-aware, evidence-grounded, and limited to a verdict plus three prioritized actions.
- Prevent `/advisor` from writing project-scoped configuration until Pi trusts the project.
- Run `onDone` review only after Pi fully settles retries, compaction recovery, and queued continuations.
- Write advisor configuration atomically with owner-only file permissions where supported.
- Document that the individual package and GitHub bundle must not be installed together.

## 0.1.7 - 2026-08-13

### Changed

- Raise the Pi peer dependency minimum to 0.84.1 and verify compatibility with that release.
- Accept Pi 0.84.1 provider headers that suppress defaults with `null` values.
- Refresh the repository lockfile to remove known dependency vulnerabilities.

## 0.1.6 - 2026-07-21

### Changed

- Raise the Pi peer dependency minimum to 0.81.1 and verify compatibility with that release.
- Update the repository lockfile to Pi's packaged `brace-expansion` 5.0.7 dependency.

## 0.1.5 - 2026-07-20

### Changed

- Correct and clarify the current Pi compatibility and autocomplete documentation.

## 0.1.4 - 2026-07-20

### Changed

- Derive advisor thinking-level choices from Pi's supported levels for the selected reviewer model.
- Add `max` support where the selected reviewer model exposes it.
- Improve `/advisor` autocomplete: `/adviso...` completes without a trailing space; model completion leads to that model's thinking-level picker; `on-done` and `when-stuck` open their value pickers directly.

## 0.1.3 - 2026-06-24

### Changed

- Bumped pi peer dependencies to `>=0.80.2`.

## 0.1.2 - 2026-06-23

### Changed

- Bumped package and pi peer/dev dependencies to `0.80.1`.
- Updated advisor completion calls to import the compatibility helper from `@earendil-works/pi-ai/compat`, matching pi-ai `0.80.1`.

## 0.1.1

### Changed

- Bumped package and pi peer/dev dependencies to `0.79.1`.
- Added pi `0.79.1` autocomplete-provider integration for `/advisor ...` and `/advise ...` arguments.
- Honor pi project trust for project-local `.pi/advisor.json`; untrusted projects cannot silently configure advisor or enable auto-triggers.

## 0.1.0

### Added

- Initial release of pi-advisor
- Added runtime config validation and pure-helper tests

### Fixed

- Retry advisor once with visible-text-only prompting when the reviewer returns reasoning-only output, and show diagnostics instead of the vague "returned no text" placeholder
- Treat `timeoutMs: 0` as provider-default timeout when calling the reviewer model
- Remove arbitrary 120-char truncation from loop-detection fingerprint
- Reorder /advise autocomplete — steer/pipe before show
- Robust arg parsing in /advisor autocomplete

### Changed

- Require an explicitly configured advisor model before sending transcripts; removed implicit latest-GPT/current-model fallback
- Documented `/advise` default injection behavior and named transcript truncation limits
- Hardened the reviewer prompt against transcript-borne prompt injection
- Made /advisor model selection scrollable so long model lists stay within the terminal view
- Refreshed the model registry before listing and resolving advisor models so OAuth/subscription-backed providers added via /login are selectable
- Allowed advisor model resolution and execution to use header-only auth as well as API-key auth
- Changed /advise so its default show mode is clearly UI-only and not presented as model-injected chat content; added pipe and steer modes to feed advisor feedback into the active conversation
- Added loop detection to when-stuck trigger
- Clarified /advisor opens interactive model picker + thinking-level selection
- Split /advisor none/default into two lines
- Merged /advisor picker rows into single line
- Updated /advisor when-stuck table row to mention loop detection
