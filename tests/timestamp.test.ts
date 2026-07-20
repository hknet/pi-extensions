import test from "node:test";
import assert from "node:assert/strict";
import {
  beginSession,
  createRuntimeState,
  finishSession,
  formatRuntimeDuration,
  takePendingSessionSummary,
} from "../packages/pi-timestamp/timestamp.js";

test("formatRuntimeDuration formats seconds through weeks", () => {
  assert.equal(formatRuntimeDuration(0), "0s");
  assert.equal(formatRuntimeDuration(42_000), "42s");
  assert.equal(formatRuntimeDuration(3_661_000), "1h 1m 1s");
  assert.equal(formatRuntimeDuration(172_805_000), "2d 5s");
  assert.equal(formatRuntimeDuration(788_645_000), "1w 2d 3h 4m 5s");
});

test("session runtime state keeps reloads open and finalizes each session once", () => {
  const state = createRuntimeState(1_000);

  assert.equal(beginSession(state, "first", 2_000), true);
  assert.equal(beginSession(state, "first", 3_000), false); // /reload
  assert.equal(state.activeSession?.startedAt, 2_000);

  assert.deepEqual(finishSession(state, 5_000), { id: "first", startedAt: 2_000, endedAt: 5_000 });
  assert.equal(finishSession(state, 6_000), undefined); // final quit must not duplicate it

  assert.equal(beginSession(state, "second", 7_000), true);
  assert.deepEqual(finishSession(state, 11_000), { id: "second", startedAt: 7_000, endedAt: 11_000 });
  assert.deepEqual(state.completedSessions, [
    { id: "first", startedAt: 2_000, endedAt: 5_000 },
    { id: "second", startedAt: 7_000, endedAt: 11_000 },
  ]);

  state.pendingSessionSummary = state.completedSessions[0];
  assert.deepEqual(takePendingSessionSummary(state), { id: "first", startedAt: 2_000, endedAt: 5_000 });
  assert.equal(takePendingSessionSummary(state), undefined);
});
