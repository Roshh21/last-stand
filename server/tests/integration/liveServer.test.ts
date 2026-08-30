import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

import type {
  MatchSnapshotDTO,
  MatchStartedPayload,
  MoveRejectedPayload,
  RoomStateDTO,
  SessionInfoDTO,
  SessionResumedDTO,
} from "@last-stand/shared";

import { createApp, type App } from "../../src/app.js";
import { TestClient } from "../support/testClient.js";

let app: App;
let baseUrl: string;

before(async () => {
  app = createApp();

  await new Promise<void>((resolve) => {
    app.httpServer.listen(0, resolve);
  });

  const { port } = app.httpServer.address() as AddressInfo;

  baseUrl = `ws://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => app.wss.close(() => resolve()));
  await new Promise<void>((resolve) => app.httpServer.close(() => resolve()));
});

test("full flow: create/join room, ready up, start, move, and reconnect mid-match", async () => {
  const alice = await TestClient.connect(baseUrl);
  const bob = await TestClient.connect(baseUrl);

  // --- Session establishment (P7) ---
  alice.send("session:hello", { nickname: "Alice" });
  const aliceCreated = await alice.waitFor<SessionInfoDTO>("session:created");

  bob.send("session:hello", { nickname: "Bob" });
  const bobCreated = await bob.waitFor<SessionInfoDTO>("session:created");

  assert.ok(aliceCreated.payload.playerId);
  assert.ok(aliceCreated.payload.sessionToken);
  assert.notEqual(aliceCreated.payload.playerId, bobCreated.payload.playerId);

  // --- Room create/join (P5) ---
  alice.send("room:create", {});
  const roomAfterCreate = await alice.waitFor<RoomStateDTO>("room:state");

  assert.equal(roomAfterCreate.payload.players.length, 1);
  assert.equal(roomAfterCreate.payload.hostPlayerId, aliceCreated.payload.playerId);
  assert.equal(roomAfterCreate.payload.status, "open");

  const roomCode = roomAfterCreate.payload.code;

  bob.send("room:join", { code: roomCode });
  const bobRoomState = await bob.waitForMatching<RoomStateDTO>(
    "room:state",
    (state) => state.players.length === 2,
  );
  const aliceSeesJoin = await alice.waitForMatching<RoomStateDTO>(
    "room:state",
    (state) => state.players.length === 2,
  );

  assert.deepEqual(
    bobRoomState.payload.players.map((p) => p.nickname).sort(),
    ["Alice", "Bob"],
  );
  assert.equal(aliceSeesJoin.payload.players.length, 2);

  // --- Ready state + real-time lobby sync (P6) ---
  alice.send("room:setReady", { ready: true });
  await alice.waitForMatching<RoomStateDTO>(
    "room:state",
    (state) => state.players.find((p) => p.playerId === aliceCreated.payload.playerId)?.ready === true,
  );

  bob.send("room:setReady", { ready: true });
  await bob.waitForMatching<RoomStateDTO>(
    "room:state",
    (state) =>
      state.players.every((p) => p.ready) && state.players.length === 2,
  );

  // --- Lobby chat placeholder ---
  bob.send("room:chat:send", { text: "gl hf" });
  const aliceChat = await alice.waitFor("room:chat:message");

  assert.equal((aliceChat.payload as { text: string }).text, "gl hf");

  // --- Starting the match (P8) ---
  alice.send("room:start", {});
  const aliceMatchStarted = await alice.waitFor<MatchStartedPayload>("match:started");
  const bobMatchStarted = await bob.waitFor<MatchStartedPayload>("match:started");

  assert.equal(aliceMatchStarted.payload.matchId, bobMatchStarted.payload.matchId);
  assert.ok(aliceMatchStarted.payload.startsAt > Date.now() - 1000);

  // --- Tick loop drives starting -> in_progress (P8) ---
  const inProgress = await alice.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) => snapshot.status === "in_progress",
    8000,
  );

  assert.equal(inProgress.payload.players.length, 2);

  const aliceStart = inProgress.payload.players.find(
    (p) => p.playerId === aliceCreated.payload.playerId,
  );

  assert.equal(aliceStart?.zoneId, "camp");
  assert.equal(aliceStart?.spectator, false);
  assert.ok(aliceStart?.avatar.color);

  // --- Movement: adjacent zone succeeds (P13) ---
  alice.send("match:move", { targetZoneId: "forest" });
  const afterMove = await alice.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) =>
      snapshot.players.find((p) => p.playerId === aliceCreated.payload.playerId)?.zoneId === "forest",
  );

  const aliceAfterMove = afterMove.payload.players.find(
    (p) => p.playerId === aliceCreated.payload.playerId,
  );

  assert.equal(aliceAfterMove?.zoneId, "forest");

  // --- Movement: an immediate second move is rejected by the cooldown,
  // even to an otherwise-valid adjacent zone (P13) ---
  alice.send("match:move", { targetZoneId: "power-station" });
  const cooldownRejection = await alice.waitFor<MoveRejectedPayload>("match:moveRejected");

  assert.equal(cooldownRejection.payload.reason, "on_cooldown");

  // --- Movement: non-adjacent zone rejected server-side, once cooldown has passed (P13) ---
  await new Promise((resolve) => setTimeout(resolve, 1600));

  alice.send("match:move", { targetZoneId: "beach" });
  const rejected = await alice.waitFor<MoveRejectedPayload>("match:moveRejected");

  assert.equal(rejected.payload.reason, "not_adjacent");
  assert.equal(rejected.payload.targetZoneId, "beach");

  // Bob should see Alice's position update too (real-time sync, P14).
  await bob.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) =>
      snapshot.players.find((p) => p.playerId === aliceCreated.payload.playerId)?.zoneId === "forest",
  );

  // --- Reconnect: refresh should not duplicate the player (P7) ---
  await alice.closeAndWait();

  // Bob should observe Alice's connection drop.
  await bob.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) =>
      snapshot.players.find((p) => p.playerId === aliceCreated.payload.playerId)?.connected === false,
  );

  const aliceReconnected = await TestClient.connect(baseUrl);

  aliceReconnected.send("session:hello", { sessionToken: aliceCreated.payload.sessionToken });
  const resumed = await aliceReconnected.waitFor<SessionResumedDTO>("session:resumed");

  assert.equal(resumed.payload.playerId, aliceCreated.payload.playerId);
  assert.deepEqual(resumed.payload.location, {
    type: "match",
    matchId: aliceMatchStarted.payload.matchId,
    roomCode,
  });

  // Rehydration: reconnecting client immediately gets a fresh snapshot, no
  // need to wait for the next tick.
  const rehydratedSnapshot = await aliceReconnected.waitFor<MatchSnapshotDTO>("match:snapshot");
  const stillOnePlayer = rehydratedSnapshot.payload.players.filter(
    (p) => p.playerId === aliceCreated.payload.playerId,
  );

  assert.equal(stillOnePlayer.length, 1, "reconnecting must not duplicate the player");
  assert.equal(stillOnePlayer[0].zoneId, "forest", "position survives the reconnect");

  // Bob should see Alice reconnected (connected: true again).
  await bob.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) =>
      snapshot.players.find((p) => p.playerId === aliceCreated.payload.playerId)?.connected === true,
  );

  await Promise.all([aliceReconnected.closeAndWait(), bob.closeAndWait()]);
});

test("joining with a garbage room code is rejected without crashing the server", async () => {
  const client = await TestClient.connect(baseUrl);

  client.send("session:hello", { nickname: "Chaos" });
  await client.waitFor<SessionInfoDTO>("session:created");

  client.send("room:join", { code: "does-not-exist" });
  const error = await client.waitFor<{ code: string }>("room:error");

  assert.equal(error.payload.code, "invalid_code");

  await client.closeAndWait();
});
