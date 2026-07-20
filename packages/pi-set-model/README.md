# pi-set-model

Remembers Pi's selected model and thinking level for each project folder.

After selecting a model and thinking level, explicitly save that combination for the current working directory with `/set-model set`. New Pi sessions opened in that directory restore it, rather than retaining the model selected in another project. Later `/model` or thinking changes do not modify the saved preference unless you run `/set-model set` again.

Preferences are stored in the project at `.pi/set-model.json`; they are never shared with another project. Pi must trust the project before the extension reads or writes this project-local setting.

## Install

```bash
pi install npm:pi-set-model
```

Or install the full collection:

```bash
pi install git:git@github.com:hknet/pi-extensions@main
```

## Commands

```text
/set-model          # view the saved preference for this folder
/set-model view     # view the saved preference for this folder
/set-model set      # save the active model and thinking level
/set-model clear    # stop restoring a preference for this folder
```

Autocomplete completes `/setm...` to `/set-model` without adding a trailing space, then offers `view`, `set`, and `clear`.

The folder is Pi's current working directory. Run Pi from the project root when you want one preference for the whole project. The setting is saved at `<cwd>/.pi/set-model.json`.

If the saved model is unavailable or has no configured API key, Pi keeps the active model and shows a warning. Thinking levels are restored after the model and are clamped to that model's supported levels by Pi. When the session ends, the model and thinking level that were active before the project preference was applied are restored.
