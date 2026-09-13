import assert from "node:assert/strict";
import { test } from "node:test";

import { RateLimiter } from "../../src/utils/RateLimiter.js";

test("allows up to the limit within a window", () => {
  const limiter = new RateLimiter(3, 1000);
  const now = 1_000_000;

  assert.equal(limiter.tryConsume("alice", now), true);
  assert.equal(limiter.tryConsume("alice", now + 10), true);
  assert.equal(limiter.tryConsume("alice", now + 20), true);
});

test("rejects once the limit is exceeded within a window", () => {
  const limiter = new RateLimiter(2, 1000);
  const now = 1_000_000;

  assert.equal(limiter.tryConsume("alice", now), true);
  assert.equal(limiter.tryConsume("alice", now + 10), true);
  assert.equal(limiter.tryConsume("alice", now + 20), false);
});

test("resets once the window rolls over", () => {
  const limiter = new RateLimiter(2, 1000);
  const now = 1_000_000;

  limiter.tryConsume("alice", now);
  limiter.tryConsume("alice", now + 10);
  assert.equal(limiter.tryConsume("alice", now + 10), false);

  assert.equal(limiter.tryConsume("alice", now + 1001), true);
});

test("different keys are tracked independently", () => {
  const limiter = new RateLimiter(1, 1000);
  const now = 1_000_000;

  assert.equal(limiter.tryConsume("alice", now), true);
  assert.equal(limiter.tryConsume("bob", now), true);
  assert.equal(limiter.tryConsume("alice", now + 1), false);
});

test("reset clears a key's window immediately", () => {
  const limiter = new RateLimiter(1, 1000);
  const now = 1_000_000;

  limiter.tryConsume("alice", now);
  assert.equal(limiter.tryConsume("alice", now + 1), false);

  limiter.reset("alice");
  assert.equal(limiter.tryConsume("alice", now + 2), true);
});
