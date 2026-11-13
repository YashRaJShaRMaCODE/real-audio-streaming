import assert from "node:assert/strict";
import test from "node:test";
import { audioCloseMessage, microphoneErrorMessage } from "./audio-diagnostics.js";

test("explains common microphone permission and device failures", () => {
  assert.match(microphoneErrorMessage({ name: "NotAllowedError" }), /Allow microphone access/);
  assert.match(microphoneErrorMessage({ name: "NotFoundError" }), /No microphone was found/);
  assert.match(microphoneErrorMessage({ name: "NotReadableError" }), /Close other apps/);
  assert.match(microphoneErrorMessage({ name: "OverconstrainedError" }), /Default microphone/);
});

test("provides fallback guidance for unknown microphone failures", () => {
  assert.match(microphoneErrorMessage({ name: "UnexpectedError" }), /Check browser permission/);
  assert.match(microphoneErrorMessage(null), /Check browser permission/);
});

test("maps server close codes to actionable connection diagnostics", () => {
  assert.match(audioCloseMessage(1008), /frame-rate limit/);
  assert.match(audioCloseMessage(1009), /oversized audio frame/);
  assert.match(audioCloseMessage(1006), /internet/);
  assert.match(audioCloseMessage(9999), /closed the session unexpectedly/);
});
