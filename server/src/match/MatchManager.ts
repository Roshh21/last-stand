import type { MatchSnapshotDTO, MoveRejectReason } from "@last-stand/shared";

import type { Room } from "../rooms/Room.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { Session } from "../session/types.js";
import { Match, type MatchPlayerInit } from "./Match.js";

export type MoveResult = { ok: true } | { ok: false; reason: MoveRejectReason };

/**
 * Owns every active Match. A Match is created once from a Room's player
 * list (P8: "On Start Game, spin up a Match and move players into it") and
 * lives independently afterwards - the originating Room is closed and
 * discarded by RoomManager.
 */
export class MatchManager {
  private readonly matchesById = new Map<string, Match>();
  private readonly sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  createMatchFromRoom(room: Room): Match {
    const playerInits: MatchPlayerInit[] = [];

    for (const playerId of room.players.keys()) {
      const session = this.sessionManager.getByPlayerId(playerId);

      if (session) {
        playerInits.push({ playerId, nickname: session.nickname });
      }
    }

    const match = new Match({ playerInits, originRoomCode: room.code });

    for (const playerId of match.getPlayerIds()) {
      const session = this.sessionManager.getByPlayerId(playerId);

      if (session) {
        session.matchId = match.matchId;
        session.roomCode = null;
      }
    }

    match.on("tick", (snapshot: MatchSnapshotDTO) => {
      this.broadcastSnapshot(match, snapshot);
    });

    match.on("ended", (matchId: string) => {
      this.matchesById.delete(matchId);
    });

    this.matchesById.set(match.matchId, match);
    match.start();

    return match;
  }

  private broadcastSnapshot(match: Match, snapshot: MatchSnapshotDTO): void {
    for (const playerId of match.getPlayerIds()) {
      const session = this.sessionManager.getByPlayerId(playerId);

      if (session) {
        this.sessionManager.sendToSession(session, "match:snapshot", snapshot);
      }
    }
  }

  getMatchById(matchId: string): Match | undefined {
    return this.matchesById.get(matchId);
  }

  handleMove(session: Session, targetZoneId: string): MoveResult {
    if (!session.matchId) {
      return { ok: false, reason: "not_in_match" };
    }

    const match = this.matchesById.get(session.matchId);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    return match.move(session.playerId, targetZoneId);
  }

  handleSessionConnected(session: Session): void {
    if (!session.matchId) {
      return;
    }

    this.matchesById.get(session.matchId)?.setConnected(session.playerId, true);
  }

  handleSessionDisconnected(session: Session): void {
    if (!session.matchId) {
      return;
    }

    this.matchesById.get(session.matchId)?.setConnected(session.playerId, false);
  }
}
