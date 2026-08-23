// Copyright © 2026 kapper.net - KAPPER NETWORK-COMMUNICATIONS GmbH
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { clampThinkingLevel } from "@earendil-works/pi-ai";
import { CONFIG_DIR_NAME, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

type ThinkingLevel = Parameters<ExtensionAPI["setThinkingLevel"]>[0];

export interface ProjectPreference {
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
}

const PREFERENCES_FILE_NAME = "set-model.json";
export const ACTIONS = [
  { value: "view", label: "view", description: "Show this folder's saved model and thinking level" },
  { value: "set", label: "set", description: "Save the active model and thinking level for this folder" },
  { value: "clear", label: "clear", description: "Remove this folder's saved model and thinking level" },
] as const satisfies readonly AutocompleteItem[];

export function isSetModelCommandPrefix(value: string): boolean {
  if (!value.startsWith("/setm") && !value.startsWith("/set-")) return false;
  return "/setmodel".startsWith(value.replace("-", ""));
}

export function getActionCompletions(prefix: string): AutocompleteItem[] | null {
  const normalized = prefix.trimStart().toLowerCase();
  if (/\s/.test(normalized)) return null;
  const matches = ACTIONS.filter((action) => action.value.startsWith(normalized));
  return matches.length > 0 ? [...matches] : null;
}

export async function loadPreference(path: string): Promise<ProjectPreference | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("expected an object");

    const preference = parsed as Partial<ProjectPreference>;
    if (
      typeof preference.provider !== "string" ||
      preference.provider.trim() === "" ||
      typeof preference.model !== "string" ||
      preference.model.trim() === "" ||
      typeof preference.thinkingLevel !== "string" ||
      preference.thinkingLevel.trim() === ""
    ) {
      throw new Error("expected non-empty provider, model, and thinkingLevel strings");
    }
    return preference as ProjectPreference;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    console.error(`pi-set-model: could not read ${path}: ${String(error)}`);
    return undefined;
  }
}

export async function savePreference(path: string, preference: ProjectPreference): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(preference, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export default function setModelExtension(pi: ExtensionAPI) {
  let preference: ProjectPreference | undefined;
  let preferencePath = "";
  let projectTrusted = false;
  let modelBeforeProjectPreference: NonNullable<ExtensionContext["model"]> | undefined;
  let thinkingBeforeProjectPreference: ThinkingLevel | undefined;
  let writeQueue = Promise.resolve();

  function queueSave(nextPreference: ProjectPreference): void {
    if (!projectTrusted || !preferencePath) return;
    preference = nextPreference;
    writeQueue = writeQueue
      .then(() => savePreference(preferencePath, nextPreference))
      .catch((error: unknown) => console.error(`pi-set-model: could not save preference: ${String(error)}`));
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) => ({
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const line = lines[cursorLine] ?? "";
        const beforeCursor = line.slice(0, cursorCol);
        if (cursorCol === line.length && isSetModelCommandPrefix(beforeCursor)) {
          if (beforeCursor === "/set-model") {
            return {
              prefix: "",
              items: ACTIONS.map((action) => ({ ...action })),
            };
          }
          return {
            prefix: beforeCursor,
            items: [{ value: "set-model", label: "set-model", description: "Project model preference" }],
          };
        }
        if (beforeCursor === "/set-model ") {
          return {
            prefix: "",
            items: ACTIONS.map((action) => ({ ...action })),
          };
        }
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        const line = lines[cursorLine] ?? "";
        const beforeCursor = line.slice(0, cursorCol);
        if (cursorCol === line.length && isSetModelCommandPrefix(beforeCursor)) {
          if (beforeCursor !== "/set-model") {
            return {
              lines: [...lines.slice(0, cursorLine), "/set-model", ...lines.slice(cursorLine + 1)],
              cursorLine,
              cursorCol: "/set-model".length,
            };
          }
          const nextLine = `/set-model ${item.value}`;
          return {
            lines: [...lines.slice(0, cursorLine), nextLine, ...lines.slice(cursorLine + 1)],
            cursorLine,
            cursorCol: nextLine.length,
          };
        }
        if (beforeCursor === "/set-model " && cursorCol === line.length) {
          const nextLine = `/set-model ${item.value}`;
          return {
            lines: [...lines.slice(0, cursorLine), nextLine, ...lines.slice(cursorLine + 1)],
            cursorLine,
            cursorCol: nextLine.length,
          };
        }
        return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        const line = lines[cursorLine] ?? "";
        const beforeCursor = line.slice(0, cursorCol);
        if (
          (isSetModelCommandPrefix(beforeCursor) || beforeCursor === "/set-model ") &&
          cursorCol === line.length
        ) return false;
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
      },
    }));

    preferencePath = join(ctx.cwd, CONFIG_DIR_NAME, PREFERENCES_FILE_NAME);
    projectTrusted = ctx.isProjectTrusted();
    preference = projectTrusted ? await loadPreference(preferencePath) : undefined;
    if (!preference) return;

    const model = ctx.modelRegistry.find(preference.provider, preference.model);
    if (!model) {
      ctx.ui.notify(`Project model unavailable: ${preference.provider}/${preference.model}`, "warning");
      return;
    }

    const previousModel = ctx.model;
    const previousThinkingLevel = pi.getThinkingLevel();
    const modelChanged =
      !previousModel || previousModel.provider !== model.provider || previousModel.id !== model.id;
    const selected = await pi.setModel(model);
    if (!selected) {
      ctx.ui.notify(`No API key for project model: ${preference.provider}/${preference.model}`, "warning");
      return;
    }
    const restoredThinkingLevel = clampThinkingLevel(model, preference.thinkingLevel);
    pi.setThinkingLevel(restoredThinkingLevel);
    modelBeforeProjectPreference = previousModel;
    thinkingBeforeProjectPreference = previousThinkingLevel;

    if (modelChanged || restoredThinkingLevel !== preference.thinkingLevel) {
      ctx.ui.notify(
        ctx.ui.theme.fg(
          "accent",
          `Project model restored: ${preference.provider}/${preference.model} · thinking: ${pi.getThinkingLevel()}` +
            (restoredThinkingLevel !== preference.thinkingLevel
              ? ` (saved level ${preference.thinkingLevel} is unsupported)`
              : ""),
        ),
        "info",
      );
    }
  });

  pi.on("session_shutdown", async () => {
    if (!modelBeforeProjectPreference) return;
    await pi.setModel(modelBeforeProjectPreference);
    if (thinkingBeforeProjectPreference !== undefined) {
      pi.setThinkingLevel(thinkingBeforeProjectPreference);
    }
  });

  pi.registerCommand("set-model", {
    description: "Save, view, or clear this folder's remembered model and thinking level",
    getArgumentCompletions: getActionCompletions,
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || "view";
      if (action === "view") {
        ctx.ui.notify(
          ctx.ui.theme.fg(
            "accent",
            preference
              ? `Project model: ${preference.provider}/${preference.model} · thinking: ${preference.thinkingLevel}`
              : "No model preference saved for this folder.",
          ),
          "info",
        );
        return;
      }

      if (action === "set") {
        if (!projectTrusted) {
          ctx.ui.notify("Trust this project before saving its model preference.", "warning");
          return;
        }
        if (!ctx.model) {
          ctx.ui.notify("No active model to save.", "warning");
          return;
        }

        const nextPreference: ProjectPreference = {
          provider: ctx.model.provider,
          model: ctx.model.id,
          thinkingLevel: pi.getThinkingLevel(),
        };
        queueSave(nextPreference);
        await writeQueue;
        ctx.ui.notify(
          `Saved project model: ${nextPreference.provider}/${nextPreference.model} · thinking: ${nextPreference.thinkingLevel}`,
          "info",
        );
        return;
      }

      if (action === "clear") {
        preference = undefined;
        if (projectTrusted && preferencePath) {
          writeQueue = writeQueue.then(async () => {
            try {
              await unlink(preferencePath);
            } catch (error: unknown) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            }
          });
          await writeQueue;
        }
        ctx.ui.notify("Cleared this folder's model preference.", "info");
        return;
      }

      ctx.ui.notify("Usage: /set-model [view|set|clear]", "error");
    },
  });
}
