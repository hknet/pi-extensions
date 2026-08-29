# Changelog

## 0.1.7 - 2026-08-29

### Changed

- Require Pi 0.84.4 or newer; this is the development, type-compatibility, and test baseline.

### Security

- Write preferences through an exclusively created, owner-only, randomly named temporary file before atomically replacing the preference file.

## 0.1.6 - 2026-08-27

### Changed

- Verify development, type compatibility, and tests against Pi SDK 0.84.3 while retaining runtime compatibility with Pi 0.84.1 and newer.

### Fixed

- Keep an existing project preference synchronized when Pi's thinking level changes for the saved model, so `/set-model` matches the footer.

## 0.1.5 - 2026-08-23

### Changed

- Add the copyright holder and EUPL licensing notice to the package license and canonical TypeScript source.
- Identify KAPPER NETWORK-COMMUNICATIONS GmbH and kapper.net in the npm author metadata.

## 0.1.4 - 2026-08-23

### Changed

- Mark Pi's host-provided SDK packages as optional wildcard peers so npm does not install a redundant Pi SDK dependency tree.
- Verify development and tests against Pi SDK 0.84.2 while retaining runtime compatibility with Pi 0.84.1 and newer.
- Reject empty saved preference fields and explicitly clamp restored thinking levels with Pi's model-capability helper.
- Document that the individual package and GitHub bundle must not be installed together.
