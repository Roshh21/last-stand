import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { WebSocket } from "ws";

import { BugReportStore } from "../../src/bugReports/BugReportStore.js";
import { MatchManager } from "../../src/match/MatchManager.js";
import { PlayerReportStore } from "../../src/moderation/PlayerReportStore.js";
import { RoomManager } from "../../src/rooms/RoomManager.js";
import type { RouterContext } from "../../src/routing/context.js";
import { handleModerationReport } from "../../src/routing/handlers/moderationHandlers.js";
import { SessionManager } from "../../src/session/SessionManager.js";
import type { Session } from "../../src/session/types.js";
import { FakeSocket } from "../support/fakeSocket.js";

function setup() {
  const tmpDir = mkdtempSync(join(tmpdir(), "last-stand-reports-"));

  const sessionManager = new SessionManager();
  const roomManager = new RoomManager(sessionManager);
  const matchManager = new MatchManager(sessionManager);
  const bugReportStore = new BugReportStore(join(tmpDir, "bug-reports.jsonl"));
  const playerReportStore = new PlayerReportStore(join(tmpDir, "player-reports.jsonl"));

  const ctx: RouterContext = { sessionManager, roomManager, matchManager, bugReportStore, playerReportStore };

  const helloResult = sessionManager.handleHello({ nickname: "Reporter" });

  if (helloResult.outcome !== "created") {
    throw new Error("expected a fresh session");
  }

  const session: Session = helloResult.session;
  const fakeSocket = new FakeSocket();

  sessionManager.attachSocket(session, fakeSocket as unknown as WebSocket);

  return { ctx, session, fakeSocket, tmpDir };
}

test("a valid report is saved with reporter metadata and acknowledged", () => {
  const { ctx, session, fakeSocket, tmpDir } = setup();

  try {
    handleModerationReport(ctx, session, { targetPlayerId: "p_target", reason: "was being disruptive" });

    const saved = ctx.playerReportStore.loadAll();

    assert.equal(saved.length, 1);
    assert.equal(saved[0].targetPlayerId, "p_target");
    assert.equal(saved[0].reason, "was being disruptive");
    assert.equal(saved[0].reporterId, session.playerId);
    assert.equal(saved[0].reporterNickname, "Reporter");

    const ack = fakeSocket.sent.find((m) => m.type === "moderation:reportAck");

    assert.ok(ack, "expected a moderation:reportAck to be sent");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("a report with no target or reason is silently ignored, nothing saved", () => {
  const { ctx, session, tmpDir } = setup();

  try {
    handleModerationReport(ctx, session, { targetPlayerId: "", reason: "" });

    assert.equal(ctx.playerReportStore.loadAll().length, 0);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("reports attach the reporter's current match id when present", () => {
  const { ctx, session, tmpDir } = setup();

  try {
    session.matchId = "m_test";

    handleModerationReport(ctx, session, { targetPlayerId: "p_target", reason: "spam" });

    const saved = ctx.playerReportStore.loadAll();

    assert.equal(saved[0].matchId, "m_test");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
