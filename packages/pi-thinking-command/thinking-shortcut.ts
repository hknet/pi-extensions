// Copyright © 2026 kapper.net - KAPPER NETWORK-COMMUNICATIONS GmbH
// SPDX-License-Identifier: EUPL-1.2

import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

type ThinkingLevel = ModelThinkingLevel;

const THINKING_LEVEL_DESCRIPTIONS: Record<ThinkingLevel, string> = {
  off: "Disable extended thinking",
  minimal: "Use the smallest available thinking budget",
  low: "Light reasoning",
  medium: "Balanced default reasoning",
  high: "More reasoning for harder tasks",
  xhigh: "Very high reasoning budget",
  max: "Maximum reasoning budget",
};

export function normalizeThinkingLevel(
  input: string,
  supportedLevels: readonly ThinkingLevel[],
): ThinkingLevel | undefined {
  const normalized = input.toLowerCase().trim();
  return supportedLevels.find((level) => level === normalized);
}

export function getThinkingLevelCompletions(
  prefix: string,
  supportedLevels: readonly ThinkingLevel[],
): AutocompleteItem[] | null {
  const normalizedPrefix = prefix.toLowerCase().trimStart();
  const matches = supportedLevels.filter((level) => level.startsWith(normalizedPrefix));

  if (matches.length === 0) return null;

  return matches.map((level) => ({
    value: level,
    label: level,
    description: THINKING_LEVEL_DESCRIPTIONS[level],
  }));
}

export function isThinkingCommandPrefix(value: string): boolean {
  return value.startsWith("/th") && "/thinking".startsWith(value);
}

export default function thinkingShortcutExtension(pi: ExtensionAPI) {
  let supportedLevels: ThinkingLevel[] = ["off"];

  const updateSupportedLevels = (model: Model<Api> | undefined) => {
    const resolved: ThinkingLevel[] = model ? getSupportedThinkingLevels(model) : ["off"];
    supportedLevels = resolved.length > 0 ? resolved : ["off"];
  };

  pi.on("session_start", (_event, ctx) => {
    updateSupportedLevels(ctx.model);
    ctx.ui.addAutocompleteProvider((current) => ({
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const line = lines[cursorLine] ?? "";
        const beforeCursor = line.slice(0, cursorCol);
        if (cursorCol === line.length && isThinkingCommandPrefix(beforeCursor)) {
          if (beforeCursor === "/thinking") {
            return { prefix: "", items: getThinkingLevelCompletions("", supportedLevels) ?? [] };
          }
          return {
            prefix: beforeCursor,
            items: [{ value: "thinking", label: "thinking", description: "Set the thinking level" }],
          };
        }
        if (beforeCursor === "/thinking " && cursorCol === line.length) {
          return { prefix: "", items: getThinkingLevelCompletions("", supportedLevels) ?? [] };
        }

        const match = beforeCursor.match(/^\/thinking\s+(\S*)$/);
        if (match && cursorCol === line.length) {
          const prefix = match[1] ?? "";
          const items = getThinkingLevelCompletions(prefix, supportedLevels);
          return items ? { prefix, items } : null;
        }
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        const line = lines[cursorLine] ?? "";
        const beforeCursor = line.slice(0, cursorCol);
        if (cursorCol === line.length && isThinkingCommandPrefix(beforeCursor)) {
          if (beforeCursor !== "/thinking") {
            return {
              lines: [...lines.slice(0, cursorLine), "/thinking", ...lines.slice(cursorLine + 1)],
              cursorLine,
              cursorCol: "/thinking".length,
            };
          }
          const nextLine = `/thinking ${item.value}`;
          return {
            lines: [...lines.slice(0, cursorLine), nextLine, ...lines.slice(cursorLine + 1)],
            cursorLine,
            cursorCol: nextLine.length,
          };
        }
        if (beforeCursor === "/thinking " && cursorCol === line.length) {
          const nextLine = `/thinking ${item.value}`;
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
        if (/^\/thinking(?:\s+\S*)?$/.test(beforeCursor) && cursorCol === line.length) return false;
        return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
      },
    }));

    ctx.ui.setStatus("thinking", `level: ${pi.getThinkingLevel()}`);
  });

  pi.on("model_select", (event) => {
    updateSupportedLevels(event.model);
  });

  pi.on("thinking_level_select", (event, ctx) => {
    ctx.ui.setStatus("thinking", `level: ${event.level}`);
  });

  pi.registerCommand("thinking", {
    description: "Set the thinking level supported by the active model",
    getArgumentCompletions: (prefix) => getThinkingLevelCompletions(prefix, supportedLevels),
    handler: async (args, ctx) => {
      updateSupportedLevels(ctx.model);
      const input = args?.trim() || (supportedLevels.includes("medium") ? "medium" : supportedLevels[0] ?? "off");
      const level = normalizeThinkingLevel(input, supportedLevels);

      if (!level) {
        ctx.ui.notify(
          `Thinking level "${input}" is not supported by the active model. Supported: ${supportedLevels.join(", ")}.`,
          "error",
        );
        return;
      }

      pi.setThinkingLevel(level);
      ctx.ui.notify(`Thinking level set to: ${pi.getThinkingLevel()}`, "info");
    },
  });
}
