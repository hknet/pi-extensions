import test from "node:test";
import assert from "node:assert/strict";
import {
  getThinkingLevelCompletions,
  isThinkingCommandPrefix,
  normalizeThinkingLevel,
} from "../packages/pi-thinking-command/thinking-shortcut.js";

test("thinking command recognizes Pi levels including max", () => {
  assert.equal(normalizeThinkingLevel(" MAX "), "max");
  assert.equal(normalizeThinkingLevel("invalid"), undefined);
  assert.deepEqual(getThinkingLevelCompletions("ma")?.map((item) => item.value), ["max"]);
});

test("thinking autocomplete intercepts /th prefixes", () => {
  assert.equal(isThinkingCommandPrefix("/th"), true);
  assert.equal(isThinkingCommandPrefix("/thinking"), true);
  assert.equal(isThinkingCommandPrefix("/theme"), false);
});
