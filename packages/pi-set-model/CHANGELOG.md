# Changelog

## 0.1.4 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Reject empty saved preference fields and explicitly clamp restored thinking levels with Pi's model-capability helper.
- Document that the individual package and GitHub bundle must not be installed together.
