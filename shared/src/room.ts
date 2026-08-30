/**
 * Room / lobby types (P5-P7).
 *
 * A Room is the pre-game lobby: players gather, ready up, and the host
 * starts the game. This is intentionally separate from Match (see match.ts),
 * which is the authoritative in-game state machine started from a Room.
 */

export type RoomStatus = "open" | "starting" | "in_game";

export interface RoomPlayerDTO {
  playerId: string;
  nickname: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomStateDTO {
  roomId: string;
  code: string;
  status: RoomStatus;
  hostPlayerId: string;
  minPlayers: number;
  maxPlayers: number;
  players: RoomPlayerDTO[];
  createdAt: number;
}

export type RoomErrorCode =
  | "invalid_code"
  | "invalid_input"
  | "room_not_found"
  | "room_full"
  | "already_in_room"
  | "not_in_room"
  | "not_host"
  | "not_enough_ready"
  | "already_started"
  | "no_session";

export function isRoomJoinable(room: Pick<RoomStateDTO, "status" | "players" | "maxPlayers">): boolean {
  return room.status === "open" && room.players.length < room.maxPlayers;
}

export function countReadyPlayers(players: Pick<RoomPlayerDTO, "ready" | "connected">[]): number {
  return players.filter((player) => player.ready && player.connected).length;
}

export function countConnectedPlayers(players: Pick<RoomPlayerDTO, "connected">[]): number {
  return players.filter((player) => player.connected).length;
}

/**
 * Start rule: every connected player must be ready, and there must be at
 * least `minPlayers` connected players. Simple and easy to reason about;
 * can be revisited once real game modes have their own requirements.
 */
export function canStartRoom(room: Pick<RoomStateDTO, "players" | "minPlayers">): boolean {
  const connected = countConnectedPlayers(room.players);

  if (connected < room.minPlayers) {
    return false;
  }

  return countReadyPlayers(room.players) === connected;
}
