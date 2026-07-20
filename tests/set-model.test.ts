import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACTIONS,
  getActionCompletions,
  isSetModelCommandPrefix,
  loadPreference,
  savePreference,
} from "../packages/pi-set-model/set-model.js";

test("set-model autocomplete exposes only view, set, and clear", () => {
  assert.equal(isSetModelCommandPrefix("/setm"), true);
  assert.equal(isSetModelCommandPrefix("/set-model"), true);
  assert.equal(isSetModelCommandPrefix("/set"), false);
  assert.deepEqual(ACTIONS.map((action) => action.value), ["view", "set", "clear"]);
  assert.deepEqual(getActionCompletions("c")?.map((item) => item.value), ["clear"]);
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
