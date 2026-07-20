# Repository guidance

## Before implementation

- Confirm extension name, npm package name, slash-command names, storage location, and intended behavior with the user before writing code.
- Read the local Pi documentation and installed source that match the versions declared in `package.json` before using an extension API.
- Prefer Pi APIs and model-capability helpers over duplicated constants. In particular, use model-specific capability helpers such as `getSupportedThinkingLevels(model)` rather than hardcoded level lists.
- Store project-local state in `<project>/.pi/` and respect `ctx.isProjectTrusted()`.

## Extension development

- Keep each extension self-contained in `packages/<package>/` with its package manifest, README, LICENSE, and canonical TypeScript source.
- Keep the root `package.json` `files` and `pi.extensions` manifests, workspace configuration, and TypeScript configuration in sync when adding an extension.
- Preserve existing behavior unless the requested change explicitly alters it.
- Add or update tests for every behavior change; test behavior rather than only implementation details.
- Test an extension in isolation without loading installed extensions:

  `pi --no-extensions -e /absolute/path/to/extension.ts`

## Documentation and releases

- Update affected package READMEs, the root README, package metadata, and changelogs before publishing.
- Preserve historical changelog entries; only correct current documentation or add a new release entry.
- Bump every changed npm workspace version and the root GitHub-bundle version. Run `npm install` to synchronize `package-lock.json`.
- Before a release, run `npm run typecheck`, `npm test`, and `npm pack --dry-run` for every workspace.
- Never run bare `npm publish` at the repository root. Publish named workspaces explicitly.
- Never commit, tag, push, or publish without explicit user approval.

## Interaction

- Keep terminal instructions concise and use plain text when the user asks for terminal-friendly output.
