# Changelog

## 0.1.10 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Measure completion through `agent_settled` so automatic retries, compaction recovery, and queued continuations produce one complete task duration.
- Document that the individual package and GitHub bundle must not be installed together.
