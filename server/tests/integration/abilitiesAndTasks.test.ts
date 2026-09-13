import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";

import {
  MOVEMENT_COOLDOWN_MS,
  getAbility,
  getElement,
  type AbilityRejectedPayload,
  type MatchSnapshotDTO,
  type MatchStartedPayload,
  type MoveRejectedPayload,
  type RoomStateDTO,
  type SessionInfoDTO,
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sends moves one hop at a time, waiting for each to land before the next (movement has a cooldown). */
async function moveAlongPath(
  client: TestClient,
  playerId: string,
  path: string[],
): Promise<MatchSnapshotDTO> {
  let latest: MatchSnapshotDTO | undefined;

  for (const zoneId of path) {
    client.send("match:move", { targetZoneId: zoneId });

    latest = (
      await client.waitForMatching<MatchSnapshotDTO>(
        "match:snapshot",
        (snapshot) => snapshot.players.find((p) => p.playerId === playerId)?.zoneId === zoneId,
      )
    ).payload;

    await sleep(MOVEMENT_COOLDOWN_MS + 100);
  }

  return latest!;
}

test("elements, abilities, and tasks: assignment, zone blocking, and a cooperative task", async () => {
  const NAMES = ["P1", "P2", "P3", "P4", "P5", "P6"];
  const clients = await Promise.all(NAMES.map(() => TestClient.connect(baseUrl)));
  const sessions: SessionInfoDTO[] = [];

  for (let i = 0; i < clients.length; i++) {
    clients[i].send("session:hello", { nickname: NAMES[i] });
    sessions.push((await clients[i].waitFor<SessionInfoDTO>("session:created")).payload);
  }

  const [host, ...guests] = clients;

  host.send("room:create", {});
  const roomState = (await host.waitFor<RoomStateDTO>("room:state")).payload;
  const roomCode = roomState.code;

  for (const guest of guests) {
    guest.send("room:join", { code: roomCode });
  }

  // Everyone (including host) sees the room fill up to 6.
  for (const client of clients) {
    await client.waitForMatching<RoomStateDTO>("room:state", (state) => state.players.length === 6);
  }

  for (const client of clients) {
    client.send("room:setReady", { ready: true });
  }

  await host.waitForMatching<RoomStateDTO>("room:state", (state) => state.players.every((p) => p.ready));

  host.send("room:start", {});

  for (const client of clients) {
    await client.waitFor<MatchStartedPayload>("match:started");
  }

  const startSnapshot = (
    await host.waitForMatching<MatchSnapshotDTO>(
      "match:snapshot",
      (snapshot) => snapshot.status === "in_progress",
      8000,
    )
  ).payload;

  // --- P15: element assignment ---
  assert.equal(startSnapshot.players.length, 6);

  const elementsAssigned = new Set(startSnapshot.players.map((p) => p.element));

  assert.equal(elementsAssigned.size, 6, "with exactly 6 players, every element should be used exactly once");

  for (const player of startSnapshot.players) {
    const elementDefinition = getElement(player.element);

    assert.equal(player.avatar.color, elementDefinition.color, "avatar color should match the element's color");
  }

  // --- P20: tasks and P24: objective present in the snapshot from the start ---
  assert.equal(startSnapshot.tasks.length, 3);
  assert.ok(startSnapshot.tasks.every((task) => task.progress === 0 && !task.completed));
  assert.deepEqual(startSnapshot.objective, {
    completedTasks: 0,
    totalTasks: 3,
    requiredTasks: 3,
    met: false,
  });
  assert.equal(startSnapshot.zones.length, 6);
  assert.ok(startSnapshot.zones.every((zone) => zone.blocked === false));

  const playerByElement = new Map(startSnapshot.players.map((p) => [p.element, p]));
  const clientByPlayerId = new Map(sessions.map((session, i) => [session.playerId, clients[i]]));

  // Reserve Lightning and Earth for the cooperative-task section below, and
  // pick the zone-blocking testers from the remaining four (Fire, Water,
  // Nature, Wind - all zone-capable), so the two sections can never pick the
  // same player and invalidate each other's assumed starting zone.
  const lightningPlayer = playerByElement.get("lightning")!;
  const earthPlayer = playerByElement.get("earth")!;
  const zoneTestCandidates = startSnapshot.players.filter(
    (p) => p.playerId !== lightningPlayer.playerId && p.playerId !== earthPlayer.playerId,
  );

  // --- P17/P18: a non-lightning player's ability toggles a zone's blocked state ---
  const zoneCapablePlayer = zoneTestCandidates.find((p) => getAbility(p.element).canTargetZone)!;
  const zoneCapableClient = clientByPlayerId.get(zoneCapablePlayer.playerId)!;
  const bystander = zoneTestCandidates.find((p) => p.playerId !== zoneCapablePlayer.playerId)!;
  const bystanderClient = clientByPlayerId.get(bystander.playerId)!;

  zoneCapableClient.send("ability:use", { targetKind: "zone", targetId: "forest" });
  await host.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) => snapshot.zones.find((z) => z.zoneId === "forest")?.blocked === true,
  );

  // Movement into the now-blocked zone is rejected server-side (P13 extended by P17/P18).
  bystanderClient.send("match:move", { targetZoneId: "forest" });
  const moveRejected = await bystanderClient.waitFor<MoveRejectedPayload>("match:moveRejected");

  assert.equal(moveRejected.payload.reason, "zone_blocked");

  // The whole match saw an anonymized ability-use event, with no playerId (P19).
  const abilityUsedMessage = await bystanderClient.waitFor("ability:used");

  assert.deepEqual(Object.keys(abilityUsedMessage.payload as object).sort(), ["element", "zoneId"]);

  // Using the ability again (after its cooldown) clears the block.
  await sleep(4100);
  zoneCapableClient.send("ability:use", { targetKind: "zone", targetId: "forest" });
  await host.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) => snapshot.zones.find((z) => z.zoneId === "forest")?.blocked === false,
  );

  bystanderClient.send("match:move", { targetZoneId: "forest" });
  const secondMoveSnapshot = await bystanderClient.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) => snapshot.players.find((p) => p.playerId === bystander.playerId)?.zoneId === "forest",
  );

  assert.equal(
    secondMoveSnapshot.payload.players.find((p) => p.playerId === bystander.playerId)?.zoneId,
    "forest",
  );

  // --- Lightning has no zone effect (P18) ---
  const lightningClient = clientByPlayerId.get(lightningPlayer.playerId)!;

  lightningClient.send("ability:use", { targetKind: "zone", targetId: lightningPlayer.zoneId });
  const noZoneEffect = await lightningClient.waitFor<AbilityRejectedPayload>("ability:rejected");

  assert.equal(noZoneEffect.payload.reason, "no_zone_effect");

  // --- P22/P23: the cooperative task requires both Lightning and Earth present at once ---
  const earthClient = clientByPlayerId.get(earthPlayer.playerId)!;

  const [lightningAtStation] = await Promise.all([
    moveAlongPath(lightningClient, lightningPlayer.playerId, ["forest", "power-station"]),
    moveAlongPath(earthClient, earthPlayer.playerId, ["dock", "power-station"]),
  ]);

  assert.equal(
    lightningAtStation.players.find((p) => p.playerId === lightningPlayer.playerId)?.zoneId,
    "power-station",
  );

  lightningClient.send("ability:use", { targetKind: "task", targetId: "activate-circuit" });

  const progressed = await host.waitForMatching<MatchSnapshotDTO>(
    "match:snapshot",
    (snapshot) => (snapshot.tasks.find((t) => t.id === "activate-circuit")?.progress ?? 0) > 0,
  );

  const circuitTask = progressed.payload.tasks.find((t) => t.id === "activate-circuit")!;

  assert.equal(circuitTask.progress, 25);
  assert.equal(circuitTask.completed, false);

  await Promise.all(clients.map((client) => client.closeAndWait()));
});

test("a cooperative task cannot be soloed even with the correct element present", async () => {
  const alice = await TestClient.connect(baseUrl);
  // Island's real minimum is 5 - the other four just need to join and ready up; only Alice moves.
  const others = await Promise.all([
    TestClient.connect(baseUrl),
    TestClient.connect(baseUrl),
    TestClient.connect(baseUrl),
    TestClient.connect(baseUrl),
  ]);

  alice.send("session:hello", { nickname: "SoloAlice" });
  const aliceSession = (await alice.waitFor<SessionInfoDTO>("session:created")).payload;

  for (let i = 0; i < others.length; i++) {
    others[i].send("session:hello", { nickname: `SoloOther${i}` });
    await others[i].waitFor<SessionInfoDTO>("session:created");
  }

  alice.send("room:create", {});
  const room = (await alice.waitFor<RoomStateDTO>("room:state")).payload;

  for (const other of others) {
    other.send("room:join", { code: room.code });
  }

  await alice.waitForMatching<RoomStateDTO>("room:state", (state) => state.players.length === 5);

  alice.send("room:setReady", { ready: true });
  for (const other of others) {
    other.send("room:setReady", { ready: true });
  }

  await alice.waitForMatching<RoomStateDTO>("room:state", (state) => state.players.every((p) => p.ready));

  alice.send("room:start", {});
  await alice.waitFor<MatchStartedPayload>("match:started");

  const snapshot = (
    await alice.waitForMatching<MatchSnapshotDTO>("match:snapshot", (s) => s.status === "in_progress", 8000)
  ).payload;

  const alicePlayer = snapshot.players.find((p) => p.playerId === aliceSession.playerId)!;

  await moveAlongPath(alice, alicePlayer.playerId, ["forest", "power-station"]);

  // Solo at the station - the cooperative task must reject regardless of
  // which element Alice has, even though four other (uninvolved) players
  // are elsewhere in the match.
  alice.send("ability:use", { targetKind: "task", targetId: "activate-circuit" });
  const rejection = await alice.waitFor<AbilityRejectedPayload>("ability:rejected");

  assert.equal(rejection.payload.reason, "needs_more_players");

  await Promise.all([alice.closeAndWait(), ...others.map((client) => client.closeAndWait())]);
});
