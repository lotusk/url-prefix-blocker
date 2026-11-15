import { test } from "node:test";
import assert from "node:assert/strict";
import { isBlocked, normalizePrefix } from "../extension/match.js";

test("normalizePrefix cleans user input", () => {
  assert.equal(normalizePrefix("  https://www.YouTube.com/shorts/ "), "youtube.com/shorts");
  assert.equal(normalizePrefix("http://reddit.com"), "reddit.com");
  assert.equal(normalizePrefix("   "), "");
});

const list = ["youtube.com/shorts", "reddit.com"];

const cases = [
  ["https://www.youtube.com/shorts/abc", true],
  ["https://m.youtube.com/shorts", true],
  ["https://youtube.com/Shorts/x?y=1", true],
  ["https://www.youtube.com/watch?v=1", false],
  ["https://www.youtube.com/", false],
  ["https://notyoutube.com/shorts/a", false],
  ["https://old.reddit.com/r/x", true],
  ["chrome://extensions", false],
  ["chrome-extension://abc/blocked.html?url=https%3A%2F%2Fwww.youtube.com%2Fshorts", false],
  ["not a url", false],
];

for (const [url, want] of cases) {
  test(`isBlocked ${url}`, () => {
    assert.equal(isBlocked(url, list), want);
  });
}
