# `/think` command extension for pi

Adds a `/think` thinking-level shortcut and status display to Pi 0.84.4 or newer.

This is especially useful when switching between model classes. Smaller models, including many local models, often benefit from tighter thinking limits than larger hosted models from major providers.

## Pi 0.84.3 command rename

This extension originally registered `/thinking`. Pi 0.84.3 took over that command name for its new native thinking selector, and built-in interactive commands take precedence over extensions. Starting with this package release, our command therefore moves to `/think` to avoid the naming conflict. Pi's native `/thinking` remains available alongside it.

Existing users should replace commands such as `/thinking high` with `/think high` when they specifically want this extension's shortcut behavior.

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
/think [level]
```

Autocomplete offers only the thinking levels supported by the active model.

Examples:

```text
/think off
/think low
/think medium
/think high
/think xhigh
/think max
```

If no argument is provided, `/think` sets the level to `medium` when supported, otherwise to the model's first supported level (normally `off` for a non-reasoning model). Use Pi 0.84.3's native `/thinking` without an argument when you want the interactive selector.

## Levels

- `off` — disable extended thinking
- `minimal` — smallest available thinking budget
- `low` — light reasoning
- `medium` — balanced default reasoning
- `high` — more reasoning for harder tasks
- `xhigh` — very high reasoning budget
- `max` — maximum reasoning budget

> **Note:** `/think` rejects levels that the active model does not support instead of silently selecting a different level.

## Features

- Registers `/think` without conflicting with Pi 0.84.3's native `/thinking` command.
- Derives argument completions from Pi's model-specific capabilities and refreshes them when the active model changes.
- Autocompletes `/th...` to `/think` without Pi's trailing-space insertion; press Tab again to open the level picker.
- Shows a `thinking` status item with the current level.
- Updates the status item when the thinking level changes.
- Validates input and displays an error for unknown or model-incompatible levels.

## Issues and feedback

Found a bug or have a feature request? Please report it on
[GitHub Issues](https://github.com/hknet/pi-extensions/issues).

For security vulnerabilities, please use
[GitHub's private vulnerability reporting](https://github.com/hknet/pi-extensions/security/advisories/new)
instead of opening a public issue.
