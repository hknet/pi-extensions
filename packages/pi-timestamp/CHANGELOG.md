# Changelog

## 0.1.12 - 2026-08-27

### Changed

- Verify development, type compatibility, and tests against Pi SDK 0.84.3 while retaining runtime compatibility with Pi 0.84.1 and newer.

## 0.1.11 - 2026-08-23

### Changed

- Add the copyright holder and EUPL licensing notice to the package license and canonical TypeScript source.
- Identify KAPPER NETWORK-COMMUNICATIONS GmbH and kapper.net in the npm author metadata.

## 0.1.10 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Measure completion through `agent_settled` so automatic retries, compaction recovery, and queued continuations produce one complete task duration.
- Document that the individual package and GitHub bundle must not be installed together.
