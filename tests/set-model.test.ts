import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import setModelExtension, {
  ACTIONS,
  getActionCompletions,
  isSetModelCommandPrefix,
  loadPreference,
  savePreference,
} from "../packages/pi-set-model/set-model.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

test("set-model autocomplete exposes only view, set, and clear", () => {
  assert.equal(isSetModelCommandPrefix("/setm"), true);
  assert.equal(isSetModelCommandPrefix("/set-model"), true);
  assert.equal(isSetModelCommandPrefix("/set"), false);
  assert.deepEqual(ACTIONS.map((action) => action.value), ["view", "set", "clear"]);
  assert.deepEqual(getActionCompletions("c")?.map((item) => item.value), ["clear"]);
});

test("set-model rejects malformed or empty preferences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-invalid-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  const originalError = console.error;
  console.error = () => {};
  try {
    await savePreference(preferenceFile, { provider: "", model: "test-model", thinkingLevel: "high" });
    assert.equal(await loadPreference(preferenceFile), undefined);
  } finally {
    console.error = originalError;
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model ignores project preferences until the project is trusted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-untrusted-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  await savePreference(preferenceFile, { provider: "test-provider", model: "test-model", thinkingLevel: "high" });

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  let setModelCalls = 0;
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => "off",
    setThinkingLevel() {},
    setModel: async () => { setModelCalls++; return true; },
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  const ctx = {
    cwd: directory,
    model: { provider: "previous", id: "previous-model" },
    isProjectTrusted: () => false,
    modelRegistry: { find: () => { throw new Error("untrusted project preference must not be read"); } },
    ui: { addAutocompleteProvider: () => {}, notify: () => {}, theme: { fg: (_color: string, message: string) => message } },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    assert.equal(setModelCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model clamps a saved thinking level to the restored model", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-restore-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  await savePreference(preferenceFile, { provider: "test-provider", model: "test-model", thinkingLevel: "max" });

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  const notifications: string[] = [];
  let thinkingLevel = "off";
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: (level: string) => { thinkingLevel = level; },
    setModel: async () => true,
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  const savedModel = {
    provider: "test-provider",
    id: "test-model",
    reasoning: true,
    thinkingLevelMap: { xhigh: null, max: null },
  };
  const ctx = {
    cwd: directory,
    model: { provider: "previous", id: "previous-model" },
    isProjectTrusted: () => true,
    modelRegistry: { find: () => savedModel },
    ui: {
      addAutocompleteProvider: () => {},
      notify: (message: string) => notifications.push(message),
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    assert.equal(thinkingLevel, "high");
    assert.match(notifications[0] ?? "", /saved level max is unsupported/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model keeps a saved preference in sync with thinking changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-thinking-change-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  await savePreference(preferenceFile, { provider: "test-provider", model: "test-model", thinkingLevel: "high" });

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  let thinkingLevel = "off";
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: (level: string) => { thinkingLevel = level; },
    setModel: async () => true,
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  const model = { provider: "test-provider", id: "test-model", reasoning: true };
  const ctx = {
    cwd: directory,
    model,
    isProjectTrusted: () => true,
    modelRegistry: { find: () => model },
    ui: {
      addAutocompleteProvider: () => {},
      notify: () => {},
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    thinkingLevel = "medium"; // Pi updates its selected level before emitting this event.
    for (const handler of handlers.get("thinking_level_select") ?? []) {
      await handler({ type: "thinking_level_select", level: "medium", previousLevel: "high" }, ctx);
    }
    assert.deepEqual(await loadPreference(preferenceFile), {
      provider: "test-provider",
      model: "test-model",
      thinkingLevel: "medium",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model ignores an immediate model-switch thinking event during restoration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-immediate-restore-event-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  const savedPreference = { provider: "project-provider", model: "project-model", thinkingLevel: "high" as const };
  await savePreference(preferenceFile, savedPreference);

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  const previousModel = { provider: "previous-provider", id: "previous-model", reasoning: true };
  const projectModel = {
    provider: savedPreference.provider,
    id: savedPreference.model,
    reasoning: true,
    thinkingLevelMap: {},
  };
  let activeModel: typeof projectModel | typeof previousModel = previousModel;
  let thinkingLevel = "medium";
  let ctx: any;
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: (level: string) => { thinkingLevel = level; },
    setModel: async (model: typeof projectModel | typeof previousModel) => {
      activeModel = model;
      const previousLevel = thinkingLevel;
      thinkingLevel = "off"; // Pi's global default is off and emits before setModel resolves.
      for (const handler of handlers.get("thinking_level_select") ?? []) {
        await handler({ type: "thinking_level_select", level: "off", previousLevel }, ctx);
      }
      return true;
    },
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  ctx = {
    cwd: directory,
    get model() { return activeModel; },
    isProjectTrusted: () => true,
    modelRegistry: { find: () => projectModel },
    ui: {
      addAutocompleteProvider: () => {},
      notify: () => {},
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    assert.equal(thinkingLevel, "high");
    assert.deepEqual(await loadPreference(preferenceFile), savedPreference);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model preserves its saved thinking level across delayed model-switch events and shutdown", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-restore-on-shutdown-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  const savedPreference = { provider: "project-provider", model: "project-model", thinkingLevel: "high" as const };
  await savePreference(preferenceFile, savedPreference);

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  const previousModel = {
    provider: "previous-provider",
    id: "previous-model",
    reasoning: true,
    thinkingLevelMap: {},
  };
  const projectModel = {
    provider: savedPreference.provider,
    id: savedPreference.model,
    reasoning: true,
    thinkingLevelMap: {},
  };
  let activeModel = previousModel;
  let thinkingLevel = "medium";
  let ctx: any;
  let deferNextThinkingEvent = true;
  const pendingThinkingEvents: Array<{ type: string; level: string; previousLevel: string }> = [];
  const pendingThinkingUpdates: Promise<unknown>[] = [];
  const dispatchThinkingEvent = (event: { type: string; level: string; previousLevel: string }) => {
    for (const handler of handlers.get("thinking_level_select") ?? []) {
      pendingThinkingUpdates.push(Promise.resolve(handler(event, ctx)));
    }
  };
  const flushThinkingEvents = async () => {
    for (const event of pendingThinkingEvents.splice(0)) dispatchThinkingEvent(event);
    await Promise.all(pendingThinkingUpdates.splice(0));
  };
  const selectThinkingLevel = (level: string) => {
    const previousLevel = thinkingLevel;
    if (level === previousLevel) return;
    thinkingLevel = level;
    const event = { type: "thinking_level_select", level, previousLevel };
    if (deferNextThinkingEvent) {
      deferNextThinkingEvent = false;
      pendingThinkingEvents.push(event);
    } else {
      dispatchThinkingEvent(event);
    }
  };
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: selectThinkingLevel,
    setModel: async (model: typeof projectModel | typeof previousModel) => {
      activeModel = model;
      // With a global default of off, Pi clamps this supported model to off and emits a change.
      selectThinkingLevel("off");
      return true;
    },
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  ctx = {
    cwd: directory,
    get model() { return activeModel; },
    isProjectTrusted: () => true,
    modelRegistry: { find: () => projectModel },
    ui: {
      addAutocompleteProvider: () => {},
      notify: () => {},
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    await flushThinkingEvents();
    assert.equal(activeModel, projectModel);
    assert.equal(thinkingLevel, "high");
    assert.deepEqual(await loadPreference(preferenceFile), savedPreference);

    for (const handler of handlers.get("session_shutdown") ?? []) {
      await handler({ type: "session_shutdown", reason: "resume" }, ctx);
    }
    await flushThinkingEvents();
    assert.equal(activeModel, previousModel);
    assert.equal(thinkingLevel, "medium");
    assert.deepEqual(await loadPreference(preferenceFile), savedPreference);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model clear stays cleared after an already queued thinking-level save", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-clear-queued-save-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  await savePreference(preferenceFile, { provider: "test-provider", model: "test-model", thinkingLevel: "high" });

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  let commandHandler: ((args: string, ctx: any) => Promise<void>) | undefined;
  let thinkingLevel = "high";
  const model = { provider: "test-provider", id: "test-model", reasoning: true };
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand(_name: string, command: { handler: (args: string, ctx: any) => Promise<void> }) {
      commandHandler = command.handler;
    },
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: (level: string) => { thinkingLevel = level; },
    setModel: async () => true,
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  const ctx = {
    cwd: directory,
    model,
    isProjectTrusted: () => true,
    modelRegistry: { find: () => model },
    ui: {
      addAutocompleteProvider: () => {},
      notify: () => {},
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    const thinkingHandler = handlers.get("thinking_level_select")?.[0];
    assert.ok(thinkingHandler);
    thinkingLevel = "medium"; // Match Pi's state before the selection event is delivered.
    // Don't await the save: clear is issued while it is pending and queues its unlink behind it.
    const queuedSave = Promise.resolve(thinkingHandler(
      { type: "thinking_level_select", level: "medium", previousLevel: "high" },
      ctx,
    ));
    assert.ok(commandHandler);
    const clear = commandHandler("clear", ctx);

    await Promise.all([queuedSave, clear]);
    assert.equal(await loadPreference(preferenceFile), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model does not save thinking changes caused by shutdown restoration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-shutdown-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  await savePreference(preferenceFile, { provider: "test-provider", model: "test-model", thinkingLevel: "high" });

  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  let thinkingLevel = "medium";
  const pi = {
    on(event: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    registerCommand() {},
    getThinkingLevel: () => thinkingLevel,
    setThinkingLevel: (level: string) => { thinkingLevel = level; },
    setModel: async () => true,
  } as unknown as ExtensionAPI;
  setModelExtension(pi);

  const model = { provider: "test-provider", id: "test-model", reasoning: true };
  const ctx = {
    cwd: directory,
    model,
    isProjectTrusted: () => true,
    modelRegistry: { find: () => model },
    ui: {
      addAutocompleteProvider: () => {},
      notify: () => {},
      theme: { fg: (_color: string, message: string) => message },
    },
  };

  try {
    for (const handler of handlers.get("session_start") ?? []) {
      await handler({ type: "session_start", reason: "startup" }, ctx);
    }
    for (const handler of handlers.get("session_shutdown") ?? []) {
      await handler({ type: "session_shutdown", reason: "quit" }, ctx);
    }
    for (const handler of handlers.get("thinking_level_select") ?? []) {
      await handler({ type: "thinking_level_select", level: "medium", previousLevel: "high" }, ctx);
    }
    assert.equal((await loadPreference(preferenceFile))?.thinkingLevel, "high");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model preferences persist locally and can be read back", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  const preference = { provider: "test-provider", model: "test-model", thinkingLevel: "high" as const };
  try {
    await savePreference(preferenceFile, preference);
    assert.deepEqual(await loadPreference(preferenceFile), preference);
    assert.match(await readFile(preferenceFile, "utf8"), /test-model/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("set-model saves concurrent preferences through private, cleaned-up temporary files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-set-model-atomic-"));
  const preferenceFile = join(directory, ".pi", "set-model.json");
  const preferences = Array.from({ length: 12 }, (_, index) => ({
    provider: "test-provider",
    model: `test-model-${index}`,
    thinkingLevel: "high" as const,
  }));
  try {
    await Promise.all(preferences.map((preference) => savePreference(preferenceFile, preference)));
    const saved = await loadPreference(preferenceFile);
    assert.ok(preferences.some((preference) => JSON.stringify(preference) === JSON.stringify(saved)));
    assert.deepEqual(await readdir(join(directory, ".pi")), ["set-model.json"]);
    if (process.platform !== "win32") assert.equal((await stat(preferenceFile)).mode & 0o077, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
