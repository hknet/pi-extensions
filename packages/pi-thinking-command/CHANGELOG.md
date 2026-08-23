# Changelog

## 0.1.9 - 2026-08-23

### Changed

- Add the copyright holder and EUPL licensing notice to the package license and canonical TypeScript source.
- Identify KAPPER NETWORK-COMMUNICATIONS GmbH and kapper.net in the npm author metadata.

## 0.1.8 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Derive `/thinking` validation and autocomplete choices from the active model's supported thinking levels, refresh them on model changes, and consolidate the overlapping autocomplete providers.
- Fall back safely to `off` when malformed custom model metadata exposes no supported thinking levels, clarify the two-step `/th` autocomplete flow, and delegate mid-line completion to Pi instead of corrupting trailing text.
- Document that the individual package and GitHub bundle must not be installed together.
