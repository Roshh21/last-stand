import assert from "node:assert/strict";
import { test } from "node:test";

import { RoomManager } from "../../src/rooms/RoomManager.js";
import { SessionManager } from "../../src/session/SessionManager.js";
import type { Session } from "../../src/session/types.js";

function makeSession(sessionManager: SessionManager, nickname: string): Session {
  const result = sessionManager.handleHello({ nickname });

  if (result.outcome !== "created") {
    throw new Error("expected a fresh session to be created");
  }

  return result.session;
}

function setup() {
  const sessionManager = new SessionManager();
  const roomManager = new RoomManager(sessionManager);

  return { sessionManager, roomManager };
}

test("createRoom makes the creator the sole player and host", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");

  const result = roomManager.createRoom(host);

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const dto = roomManager.toDTO(result.value);

  assert.equal(dto.players.length, 1);
  assert.equal(dto.hostPlayerId, host.playerId);
  assert.equal(dto.status, "open");
});

test("createRoom fails if the session is already in a room", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");

  roomManager.createRoom(host);
  const second = roomManager.createRoom(host);

  assert.deepEqual(second, { ok: false, code: "already_in_room" });
});

test("joinRoom by code adds a second player and both see each other", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const guest = makeSession(sessionManager, "Guest");

  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const joined = roomManager.joinRoom(guest, created.value.code);

  assert.equal(joined.ok, true);
  if (!joined.ok) return;

  const dto = roomManager.toDTO(joined.value);

  assert.equal(dto.players.length, 2);
  assert.deepEqual(
    dto.players.map((p) => p.nickname).sort(),
    ["Guest", "Host"],
  );
});

test("joinRoom fails with room_not_found for an unknown code", () => {
  const { sessionManager, roomManager } = setup();
  const guest = makeSession(sessionManager, "Guest");

  const result = roomManager.joinRoom(guest, "ZZZZZ");

  assert.deepEqual(result, { ok: false, code: "room_not_found" });
});

test("joinRoom fails with invalid_code for a malformed code", () => {
  const { sessionManager, roomManager } = setup();
  const guest = makeSession(sessionManager, "Guest");

  const result = roomManager.joinRoom(guest, "!!");

  assert.deepEqual(result, { ok: false, code: "invalid_code" });
});

test("joinRoom fails with room_full once max players is reached", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  created.value.maxPlayers = 1;

  const guest = makeSession(sessionManager, "Guest");
  const result = roomManager.joinRoom(guest, created.value.code);

  assert.deepEqual(result, { ok: false, code: "room_full" });
});

test("joinRoom fails with already_in_room if the session is already seated somewhere", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  roomManager.joinRoom(guest, created.value.code);

  const other = roomManager.createRoom(guest);

  assert.deepEqual(other, { ok: false, code: "already_in_room" });
});

test("beginStart requires the host", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  roomManager.joinRoom(guest, created.value.code);

  const result = roomManager.beginStart(guest);

  assert.deepEqual(result, { ok: false, code: "not_host" });
});

test("beginStart requires everyone connected to be ready", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  roomManager.joinRoom(guest, created.value.code);

  const tooEarly = roomManager.beginStart(host);
  assert.deepEqual(tooEarly, { ok: false, code: "not_enough_ready" });

  roomManager.setReady(host, true);
  roomManager.setReady(guest, true);

  const result = roomManager.beginStart(host);
  assert.equal(result.ok, true);
});

test("leaveRoom reassigns host to the next-longest-standing player", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  roomManager.joinRoom(guest, created.value.code);

  const leftResult = roomManager.leaveRoom(host);
  assert.equal(leftResult.ok, true);
  if (!leftResult.ok || !leftResult.value) return;

  const dto = roomManager.toDTO(leftResult.value);

  assert.equal(dto.hostPlayerId, guest.playerId);
  assert.equal(dto.players.length, 1);
});

test("leaveRoom deletes the room once the last player leaves", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const code = created.value.code;
  roomManager.leaveRoom(host);

  assert.equal(roomManager.getRoomByCode(code), undefined);
});

test("a disconnected player is excluded from the ready-threshold count", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  const third = makeSession(sessionManager, "Third");
  roomManager.joinRoom(guest, created.value.code);
  roomManager.joinRoom(third, created.value.code);
  roomManager.setReady(host, true);
  roomManager.setReady(third, true);

  // Guest never readies up but disconnects instead - the other two (still
  // meeting minPlayers) are both ready, so starting should be allowed.
  guest.connected = false;

  const result = roomManager.beginStart(host);

  assert.equal(result.ok, true);
});

test("beginStart still requires minPlayers connected even if everyone connected is ready", () => {
  const { sessionManager, roomManager } = setup();
  const host = makeSession(sessionManager, "Host");
  const created = roomManager.createRoom(host);
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const guest = makeSession(sessionManager, "Guest");
  roomManager.joinRoom(guest, created.value.code);
  roomManager.setReady(host, true);

  // Only the host remains connected and ready - below the 2-player minimum.
  guest.connected = false;

  const result = roomManager.beginStart(host);

  assert.deepEqual(result, { ok: false, code: "not_enough_ready" });
});
