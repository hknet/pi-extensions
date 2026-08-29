# pi-timestamp

Shows timestamps for user input and agent completion timing. Requires Pi 0.84.4 or newer.

## What it does

- **User input**: Shows `Sent HH:MM:SS` as a dim status line in the chat display after each user message
- **Agent completion**: Shows `Done at HH:MM:SS · duration` as a dim status line in the chat display after each agent turn. If an extension UI prompt paused the run, it instead shows total, active-agent, and user-waiting time (e.g., `Done at 14:32:05 · total 8.2s · active 3.2s · waiting 5.0s`).
- **Session/runtime summaries**: Shows accent-colored summaries when switching sessions and at final Pi exit, including start/end times and durations. The final summary includes the complete Pi process runtime and every session interval.

All timestamps and summaries are **display-only** — session-switch summaries render in Pi's UI and the final runtime summary prints after Pi restores the terminal in TUI mode. They never enter the LLM context.

## Display behavior

Timestamps appear inline in the **chat display**, similar to Pi's built-in tool timing lines such as `Took 1.9s`. They are not appended to the session as user or custom messages, so they do not pollute the model context.

## Installation

> **Avoid duplicate installation.** Install this npm package or the GitHub bundle, not both. Loading both copies can duplicate timestamps and runtime summaries.

```bash
pi install npm:@hk_net/pi-timestamp
```

Or copy manually:

```bash
mkdir -p ~/.pi/agent/extensions
cp packages/pi-timestamp/timestamp.ts ~/.pi/agent/extensions/timestamp.ts
```

## Duration measurement

Captured from the first `agent_start` to `agent_settled`, so automatic retries, compaction recovery, tool calls, and queued continuations are included in one complete task duration. When an extension opens a blocking UI prompt during that run, Pi 0.84.4's prompt events subtract that user-wait time from the reported active-agent duration while retaining it in the total.

## Issues and feedback

Found a bug or have a feature request? Please report it on
[GitHub Issues](https://github.com/hknet/pi-extensions/issues).

For security vulnerabilities, please use
[GitHub's private vulnerability reporting](https://github.com/hknet/pi-extensions/security/advisories/new)
instead of opening a public issue.
