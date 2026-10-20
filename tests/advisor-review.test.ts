import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Api, Model } from "@earendil-works/pi-ai";
import { registerFauxProvider } from "@earendil-works/pi-ai/compat";
import { fauxAssistantMessage, fauxThinking } from "@earendil-works/pi-ai/providers/faux";
import advisorExtension, {
  buildTranscript, getAdviseCompletions, resolveAdviseMode,
  resolveEffectiveConfig, resolveAdvisor, tryModel,
} from "../packages/pi-advisor/advisor.js";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "advisor-review-"));
  const home = join(dir, "home");
  const cwd = join(dir, "project");
  mkdirSync(join(home, ".pi", "agent"), { recursive: true });
  mkdirSync(join(cwd, ".pi"), { recursive: true });
  const keys = ["HOME", "USERPROFILE", "PI_ADVISOR_MODEL", "PI_ADVISOR_EFFORT", "PI_ADVISOR_TIMEOUT_MS"];
  const saved = keys.map(key => [key, process.env[key]] as const);
  for (const key of keys) delete process.env[key];
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return {
    cwd,
    project: (config: object) => writeFileSync(join(cwd, ".pi", "advisor.json"), JSON.stringify(config)),
    global: (config: object) => writeFileSync(join(home, ".pi", "agent", "advisor.json"), JSON.stringify(config)),
    close() {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const model = {
  provider: "reviewer", id: "model", api: "openai-completions", reasoning: true,
  contextWindow: 32000, maxTokens: 4096,
} as Model<Api>;

function harness(cwd: string, reviewer = model) {
  const handlers = new Map<string, Array<(event: any, ctx: any) => unknown>>();
  const commands = new Map<string, any>();
  const sent: unknown[] = [];
  let active = ["read", "advisor"];
  let authCalls = 0;
  let auth: () => Promise<any> = async () => ({ ok: false });
  let trusted = true;
  const registry = {
    refresh() {}, getAvailable: () => [reviewer],
    find: (provider: string, id: string) => provider === reviewer.provider && id === reviewer.id ? reviewer : undefined,
    hasConfiguredAuth: () => true,
    getApiKeyAndHeaders: () => { authCalls++; return auth(); },
  };
  const ctx = {
    cwd, hasUI: false, isProjectTrusted: () => trusted, isIdle: () => true,
    modelRegistry: registry,
    sessionManager: { getBranch: () => [{ type: "message", message: { role: "user", content: "Review this tested change." } }] },
    ui: { notify() {} },
  } as unknown as ExtensionContext;
  advisorExtension({
    on(name: string, handler: (event: any, ctx: any) => unknown) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler]);
    },
    registerCommand(name: string, command: unknown) { commands.set(name, command); },
    registerTool() {}, registerMessageRenderer() {},
    getActiveTools: () => active,
    setActiveTools: (tools: string[]) => { active = tools; },
    sendUserMessage: (...args: unknown[]) => sent.push(args),
    sendMessage: (...args: unknown[]) => sent.push(args),
  } as unknown as ExtensionAPI);
  return {
    ctx, registry, commands, sent,
    get calls() { return authCalls; },
    get active() { return active; },
    setAuth: (fn: typeof auth) => { auth = fn; },
    trust: (value: boolean) => { trusted = value; },
    async emit(name: string, event: object = {}) {
      for (const handler of handlers.get(name) ?? []) await handler(event, ctx);
    },
  };
}

const result = (name: string, isError = false) => ({ toolName: name, input: { command: name }, isError });

// Environment mutations are restored in finally; tests in this file run sequentially.
test("configuration resolves defaults, per-key overrides, explicit false/zero, trust, and environment", () => {
  const f = fixture();
  try {
    assert.deepEqual(resolveEffectiveConfig(f.cwd), {
      spec: undefined, source: "default", thinking: "high", onDone: false, whenStuck: 0, timeoutMs: 120000,
    });
    f.global({ model: "reviewer/model", thinking: "medium", onDone: true, whenStuck: 4, timeoutMs: 9000 });
    f.project({ model: "none", onDone: false, whenStuck: 0, timeoutMs: 0 });
    assert.deepEqual(resolveEffectiveConfig(f.cwd), {
      spec: "none", source: "project", thinking: "medium", onDone: false, whenStuck: 0, timeoutMs: 0,
    });
    assert.deepEqual(resolveEffectiveConfig(f.cwd, false), {
      spec: "reviewer/model", source: "global", thinking: "medium", onDone: true, whenStuck: 4, timeoutMs: 9000,
    });
    process.env.PI_ADVISOR_MODEL = " other/reviewer ";
    process.env.PI_ADVISOR_EFFORT = " low ";
    process.env.PI_ADVISOR_TIMEOUT_MS = " 1234 ";
    assert.deepEqual(resolveEffectiveConfig(f.cwd), {
      spec: "other/reviewer", source: "env PI_ADVISOR_MODEL", thinking: "low", onDone: false, whenStuck: 0, timeoutMs: 1234,
    });
    process.env.PI_ADVISOR_MODEL = " ";
    process.env.PI_ADVISOR_EFFORT = "\t";
    for (const invalid of [" ", "NaN", "-1", "1.5", "Infinity"]) {
      process.env.PI_ADVISOR_TIMEOUT_MS = invalid;
      assert.equal(resolveEffectiveConfig(f.cwd, false).timeoutMs, 9000);
    }
    process.env.PI_ADVISOR_TIMEOUT_MS = "0";
    assert.equal(resolveEffectiveConfig(f.cwd, false).timeoutMs, 0);
    assert.equal(resolveEffectiveConfig(f.cwd).spec, "none");
    assert.equal(resolveEffectiveConfig(f.cwd).thinking, "medium");
  } finally { f.close(); }
});

test("model resolution handles API-key/header auth, rejects missing auth and never falls back", async () => {
  const f = fixture();
  try {
    const h = harness(f.cwd);
    assert.equal(await tryModel(h.ctx, "invalid"), undefined);
    assert.equal(await tryModel(h.ctx, "missing/model"), undefined);
    assert.equal(h.calls, 0);
    h.registry.hasConfiguredAuth = () => false;
    assert.equal(await tryModel(h.ctx, "reviewer/model"), undefined);
    assert.equal(h.calls, 0);
    h.registry.hasConfiguredAuth = () => true;
    for (const auth of [{ ok: false }, { ok: true }]) {
      h.setAuth(async () => auth);
      assert.equal(await tryModel(h.ctx, "reviewer/model"), undefined);
    }
    for (const auth of [{ ok: true, apiKey: "test-key" }, { ok: true, headers: { Authorization: "test-header", "x-remove": null } }]) {
      h.setAuth(async () => auth);
      const resolved = await tryModel(h.ctx, "reviewer/model");
      assert.equal(resolved?.model, model);
      assert.deepEqual(resolved?.headers, "headers" in auth ? auth.headers : undefined);
      assert.equal(resolved?.apiKey, "apiKey" in auth ? auth.apiKey : undefined);
    }
    f.project({ model: "none" });
    const calls = h.calls;
    assert.equal(await resolveAdvisor(h.ctx, resolveEffectiveConfig(f.cwd)), null);
    assert.equal(h.calls, calls);
    f.project({});
    await assert.rejects(resolveAdvisor(h.ctx, resolveEffectiveConfig(f.cwd)), /not configured/);
    f.project({ model: "missing/model" });
    await assert.rejects(resolveAdvisor(h.ctx, resolveEffectiveConfig(f.cwd)), /unavailable or lacks auth/);
    f.project({ model: "reviewer/model", thinking: "unsupported", timeoutMs: 456 });
    const resolved = await resolveAdvisor(h.ctx, resolveEffectiveConfig(f.cwd));
    assert.equal(resolved?.thinking, "high");
    assert.equal(resolved?.warnings.length, 1);
    assert.equal(resolved?.timeoutMs, 456);
    h.registry.refresh = () => { throw new Error("offline"); };
    assert.ok(await resolveAdvisor(h.ctx, resolveEffectiveConfig(f.cwd)));
  } finally { f.close(); }
});

test("live configuration changes update visibility at input, start, and status boundaries", async () => {
  const f = fixture();
  try {
    const h = harness(f.cwd);
    await h.emit("session_start");
    f.project({ model: "none" });
    await h.emit("input", { source: "interactive" });
    assert.deepEqual(h.active, ["read"]);
    f.project({ model: "reviewer/model" });
    await h.emit("before_agent_start");
    assert.deepEqual(h.active, ["read", "advisor"]);
    f.project({ model: "none" });
    await h.commands.get("advisor").handler("status", h.ctx);
    assert.deepEqual(h.active, ["read"]);
    h.trust(false);
    await h.emit("before_agent_start");
    assert.deepEqual(h.active, ["read", "advisor"]);
  } finally { f.close(); }
});

test("error and loop triggers are independent and identical failures cause only one review", async () => {
  const f = fixture();
  try {
    f.project({ model: "reviewer/model", whenStuck: 2 });
    const h = harness(f.cwd);
    await h.emit("session_start");
    await h.emit("tool_result", result("a", true));
    await h.emit("tool_result", result("b", true));
    assert.equal(h.calls, 1);
    await h.emit("tool_result", result("c"));
    await h.emit("tool_result", result("c"));
    assert.equal(h.calls, 2);
    await h.emit("tool_result", result("d", true));
    await h.emit("tool_result", result("d", true));
    assert.equal(h.calls, 3);
    await h.emit("tool_result", result("e", true));
    await h.emit("tool_result", result("f"));
    await h.emit("tool_result", result("g", true));
    assert.equal(h.calls, 3); // success resets errors; different arguments reset loop
    await h.emit("tool_result", result("advisor", true));
    assert.equal(h.calls, 3);
  } finally { f.close(); }
});

test("session changes and aborted settlement reset every trigger without an input event", async () => {
  const f = fixture();
  try {
    f.project({ model: "reviewer/model", whenStuck: 2, onDone: true });
    const h = harness(f.cwd);
    await h.emit("tool_result", result("a", true));
    await h.emit("session_start");
    await h.emit("tool_result", result("a", true));
    assert.equal(h.calls, 0);
    await h.emit("agent_settled", { aborted: true });
    assert.equal(h.calls, 0); // abort must not start an on-done review
    await h.emit("tool_result", result("a", true));
    assert.equal(h.calls, 0);
    await h.emit("agent_settled", { aborted: false });
    await h.emit("agent_settled", { aborted: false });
    assert.equal(h.calls, 1); // once per prompt
    await h.emit("input", { source: "extension" });
    await h.emit("agent_settled", { aborted: false });
    assert.equal(h.calls, 1); // own injection must not reset the guard
    await h.emit("input", { source: "rpc" });
    await h.emit("agent_settled", { aborted: false });
    assert.equal(h.calls, 2);
  } finally { f.close(); }
});

test("old automatic reviews cannot unlock new reviews or deliver after session replacement", async () => {
  const f = fixture();
  try {
    f.project({ model: "reviewer/model", whenStuck: 1 });
    const h = harness(f.cwd);
    const pending: Array<(auth: object) => void> = [];
    h.setAuth(() => new Promise(resolve => pending.push(resolve)));
    const old = h.emit("tool_result", result("old"));
    assert.equal(h.calls, 1);
    await h.emit("session_shutdown");
    await h.emit("session_start");
    const current = h.emit("tool_result", result("current"));
    assert.equal(h.calls, 2);
    pending[0]({ ok: true, apiKey: "test-key" });
    await old; // aborted after auth, before any provider request
    await h.emit("tool_result", result("parallel"));
    assert.equal(h.calls, 2); // old finally must not clear the new guard
    await h.emit("session_shutdown");
    pending[1]({ ok: true, apiKey: "test-key" });
    await current;
    assert.deepEqual(h.sent, []);
  } finally { f.close(); }
});

test("manual review cancelled during auth produces no feedback after a new prompt", async () => {
  const f = fixture();
  try {
    f.project({ model: "reviewer/model" });
    const h = harness(f.cwd);
    let finish!: (auth: object) => void;
    h.setAuth(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.commands.get("advise").handler("show", h.ctx);
    await h.emit("input", { source: "interactive" });
    finish({ ok: true, apiKey: "test-key" });
    await pending;
    assert.deepEqual(h.sent, []);
  } finally { f.close(); }
});

test("advise mode and completion normalize whitespace/case and reject extra arguments", () => {
  for (const mode of ["show", "pipe", "steer"] as const) {
    assert.equal(resolveAdviseMode(` \t${mode.toUpperCase()}\n`, true), mode);
    assert.deepEqual(getAdviseCompletions(` ${mode.toUpperCase()} `)?.map(x => x.value), [mode]);
  }
  assert.equal(resolveAdviseMode(" \t ", false), "steer");
  assert.equal(resolveAdviseMode(" \t ", true), "pipe");
  for (const input of ["show extra", "steering", "?"]) assert.equal(resolveAdviseMode(input, true), undefined);
  assert.deepEqual(getAdviseCompletions(" \t")?.map(x => x.value), ["?", "steer", "pipe", "show"]);
  assert.deepEqual(getAdviseCompletions("S")?.map(x => x.value), ["steer", "show"]);
  assert.deepEqual(getAdviseCompletions("bogus"), []);
  assert.deepEqual(getAdviseCompletions("show extra"), []);
});

test("automatic feedback delivers once and manual show stays display-only using a local faux provider", async () => {
  const f = fixture();
  const faux = registerFauxProvider({ provider: "reviewer", models: [{ id: "model", contextWindow: 32000, maxTokens: 4096 }], tokensPerSecond: 0 });
  try {
    f.project({ model: "reviewer/model", onDone: true });
    const h = harness(f.cwd, faux.getModel());
    h.setAuth(async () => ({ ok: true, apiKey: "test-key" }));
    faux.setResponses([fauxAssistantMessage("Ready."), fauxAssistantMessage("For the human.")]);
    await h.emit("agent_settled", { aborted: false });
    await h.emit("agent_settled", { aborted: false });
    assert.equal(faux.state.callCount, 1);
    assert.match((h.sent[0] as any[])[0], /Ready\./);
    assert.deepEqual((h.sent[0] as any[])[1], { deliverAs: "followUp" });
    await h.commands.get("advise").handler("show", h.ctx);
    assert.equal(faux.state.callCount, 2);
    assert.equal((h.sent[1] as any[])[0].customType, "advisor");
    assert.match((h.sent[1] as any[])[0].content, /For the human\./);
    assert.deepEqual((h.sent[1] as any[])[1], { triggerTurn: false });
  } finally { faux.unregister(); f.close(); }
});

test("reasoning-only review retries once, but cancellation during generation sends no feedback", async () => {
  const f = fixture();
  const faux = registerFauxProvider({ provider: "reviewer", models: [{ id: "model", contextWindow: 32000, maxTokens: 4096 }], tokensPerSecond: 0 });
  try {
    f.project({ model: "reviewer/model" });
    const h = harness(f.cwd, faux.getModel());
    h.setAuth(async () => ({ ok: true, apiKey: "test-key" }));
    faux.setResponses([fauxAssistantMessage(fauxThinking("private reasoning")), fauxAssistantMessage("Visible advice.")]);
    await h.commands.get("advise").handler("pipe", h.ctx);
    assert.equal(faux.state.callCount, 2);
    assert.equal(h.sent.length, 1);
    assert.match((h.sent[0] as any[])[0], /Visible advice\./);
    assert.doesNotMatch((h.sent[0] as any[])[0], /private reasoning/);
    faux.setResponses([async () => {
      await h.emit("input", { source: "interactive" });
      return fauxAssistantMessage(fauxThinking("cancelled reasoning"));
    }]);
    await h.commands.get("advise").handler("show", h.ctx);
    assert.equal(faux.state.callCount, 3); // no retry after cancellation
    assert.equal(h.sent.length, 1); // no stale or misleading timeout message
  } finally { faux.unregister(); f.close(); }
});

test("transcript budget includes truncation markers and bounds a single giant section", () => {
  const budgetModel = { contextWindow: 5000, maxTokens: 1000 };
  const budget = (5000 - 1000 - 2000) * 3.5;
  const entries = [{ type: "message", message: { role: "user", content: "界".repeat(50000) + "LATEST" } }];
  const text = buildTranscript(entries, budgetModel);
  assert.ok(text.length <= budget);
  assert.match(text, /truncated/);
  assert.ok(text.endsWith("LATEST"));
  assert.equal(buildTranscript(entries, { contextWindow: 1000, maxTokens: 1000 }), "");
  assert.equal(buildTranscript([], budgetModel), "");
  const small = [{ type: "message", message: { role: "user", content: "hello" } }];
  assert.equal(buildTranscript(small, budgetModel), "## User\nhello");
});
