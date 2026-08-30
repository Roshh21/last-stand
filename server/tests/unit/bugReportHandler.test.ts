import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { WebSocket } from "ws";

import { BugReportStore } from "../../src/bugReports/BugReportStore.js";
import { MatchManager } from "../../src/match/MatchManager.js";
import { RoomManager } from "../../src/rooms/RoomManager.js";
import type { RouterContext } from "../../src/routing/context.js";
import { handleBugReportSubmit } from "../../src/routing/handlers/bugReportHandlers.js";
import { SessionManager } from "../../src/session/SessionManager.js";
import type { Session } from "../../src/session/types.js";
import { FakeSocket } from "../support/fakeSocket.js";

function setup() {
  const tmpDir = mkdtempSync(join(tmpdir(), "last-stand-bugreports-"));
  const filePath = join(tmpDir, "bug-reports.jsonl");

  const sessionManager = new SessionManager();
  const roomManager = new RoomManager(sessionManager);
  const matchManager = new MatchManager(sessionManager);
  const bugReportStore = new BugReportStore(filePath);

  const ctx: RouterContext = { sessionManager, roomManager, matchManager, bugReportStore };

  const helloResult = sessionManager.handleHello({ nickname: "Tester" });

  if (helloResult.outcome !== "created") {
    throw new Error("expected a fresh session");
  }

  const session: Session = helloResult.session;
  const fakeSocket = new FakeSocket();

  sessionManager.attachSocket(session, fakeSocket as unknown as WebSocket, "test-agent/1.0");

  return { ctx, session, fakeSocket, tmpDir };
}

test("a valid bug report is saved with technical metadata and acknowledged", () => {
  const { ctx, session, fakeSocket, tmpDir } = setup();

  try {
    handleBugReportSubmit(ctx, session, {
      description: "  The map failed to render.  ",
      whatWasHappening: "Joining a room",
      expectedResult: "The lobby should appear",
      actualResult: "Blank screen",
    });

    const saved = ctx.bugReportStore.loadAll();

    assert.equal(saved.length, 1);
    assert.equal(saved[0].description, "The map failed to render.");
    assert.equal(saved[0].playerId, session.playerId);
    assert.equal(saved[0].nickname, "Tester");
    assert.equal(saved[0].userAgent, "test-agent/1.0");
    assert.equal(saved[0].roomCode, null);
    assert.equal(saved[0].matchId, null);
    assert.equal(typeof saved[0].appVersion, "string");

    const ack = fakeSocket.sent.find((m) => m.type === "bugReport:ack");

    assert.ok(ack, "expected a bugReport:ack to be sent");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("a report with no description is rejected and nothing is saved", () => {
  const { ctx, session, fakeSocket, tmpDir } = setup();

  try {
    handleBugReportSubmit(ctx, session, {
      description: "   ",
      whatWasHappening: "",
      expectedResult: "",
      actualResult: "",
    });

    assert.equal(ctx.bugReportStore.loadAll().length, 0);

    const error = fakeSocket.sent.find((m) => m.type === "bugReport:error");

    assert.ok(error, "expected a bugReport:error to be sent");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("bug reports attach the player's current room and match if present", () => {
  const { ctx, session, tmpDir } = setup();

  try {
    session.roomCode = "ABCDE";
    session.matchId = "m_test";

    handleBugReportSubmit(ctx, session, { description: "Something odd" });

    const saved = ctx.bugReportStore.loadAll();

    assert.equal(saved[0].roomCode, "ABCDE");
    assert.equal(saved[0].matchId, "m_test");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
