# `/thinking` command extension for pi

Adds a `/thinking` slash command to Pi 0.84.1 or newer (tested with the current Pi 0.84.2 release) for changing the active thinking/reasoning level from inside a session.

Normally in pi, changing the thinking/reasoning level means opening the settings menu, navigating to **Thinking**, and selecting the requested level. This extension is a convenience shortcut for that workflow, so you can switch levels directly with commands such as `/thinking low` or `/thinking xhigh`.

This is especially useful when switching between model classes. Smaller models, including many local models, often benefit from tighter thinking limits than larger hosted models from major providers.

## Install

> **Avoid duplicate installation.** Install this npm package or the GitHub bundle, not both. Loading both copies can duplicate commands, autocomplete providers, and status updates.

Install just this extension from npm:

```bash
pi install npm:@hk_net/pi-thinking-command
```

Or install the full collection from GitHub:

```bash
pi install git:git@github.com:hknet/pi-extensions@main
pi install https://github.com/hknet/pi-extensions
```

Or install this extension manually:

```bash
cp packages/pi-thinking-command/thinking-shortcut.ts ~/.pi/agent/extensions/thinking-shortcut.ts
```

After installing, restart pi or run:

```text
/reload
```

## Usage

```text
/thinking [level]
```

Autocomplete offers only the thinking levels supported by the active model.

Examples:

```text
/thinking off
/thinking low
/thinking medium
/thinking high
/thinking xhigh
/thinking max
```

If no argument is provided, `/thinking` sets the level to `medium` when supported, otherwise to the model's first supported level (normally `off` for a non-reasoning model).

## Levels

- `off` — disable extended thinking
- `minimal` — smallest available thinking budget
- `low` — light reasoning
- `medium` — balanced default reasoning
- `high` — more reasoning for harder tasks
- `xhigh` — very high reasoning budget
- `max` — maximum reasoning budget

> **Note:** `/thinking` rejects levels that the active model does not support instead of silently selecting a different level.

## Features

- Registers the `/thinking` command.
- Derives argument completions from Pi's model-specific capabilities and refreshes them when the active model changes.
- Autocompletes `/th...` to `/thinking` without Pi's trailing-space insertion; press Tab again to open the level picker.
- Shows a `thinking` status item with the current level.
- Updates the status item when the thinking level changes.
- Validates input and displays an error for unknown or model-incompatible levels.

## Issues and feedback

Found a bug or have a feature request? Please report it on
[GitHub Issues](https://github.com/hknet/pi-extensions/issues).

For security vulnerabilities, please use
[GitHub's private vulnerability reporting](https://github.com/hknet/pi-extensions/security/advisories/new)
instead of opening a public issue.
