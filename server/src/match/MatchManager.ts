import type {
  AbilityRejectReason,
  AbilityTargetKind,
  ChatRejectReason,
  ElementId,
  KeyTransferRejectReason,
  MatchChatMessageDTO,
  MatchSnapshotDTO,
  MessageType,
  MoveRejectReason,
} from "@last-stand/shared";

import type { Room } from "../rooms/Room.js";
import type { SessionManager } from "../session/SessionManager.js";
import type { Session } from "../session/types.js";
import { Match, type MatchPlayerInit } from "./Match.js";

export type MoveResult = { ok: true } | { ok: false; reason: MoveRejectReason };
export type AbilityUseResult = { ok: true } | { ok: false; reason: AbilityRejectReason };
export type ChatActionResult = { ok: true } | { ok: false; reason: ChatRejectReason };
export type KeyTransferActionResult = { ok: true } | { ok: false; reason: KeyTransferRejectReason };

/**
 * Owns every active Match. A Match is created once from a Room's player
 * list (P8: "On Start Game, spin up a Match and move players into it") and
 * lives independently afterwards - the originating Room is closed and
 * discarded by RoomManager.
 *
 * Beyond match creation, this class's other job is fan-out: taking a
 * result computed by `Match` (which only knows about players, not
 * sockets) and delivering it to exactly the right session(s) - the whole
 * match, one team, or the two participants of a private/traitor thread.
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
      this.broadcastTick(match, snapshot);
    });

    match.on("abilityUsed", (event: { element: ElementId; zoneId: string }) => {
      this.broadcastToPlayers(match.getPlayerIds(), "ability:used", event);
    });

    match.on("teamChatMessage", (event: { teamId: string; message: MatchChatMessageDTO }) => {
      this.broadcastToPlayers(match.getTeamMemberIds(event.teamId), "match:chat:message", event.message);
    });

    match.on("ended", (matchId: string) => {
      this.matchesById.delete(matchId);
    });

    this.matchesById.set(match.matchId, match);
    match.start();

    return match;
  }

  /** Every tick: the public snapshot to everyone, plus each player's OWN private state (role, key, threads). */
  private broadcastTick(match: Match, snapshot: MatchSnapshotDTO): void {
    for (const playerId of match.getPlayerIds()) {
      const session = this.sessionManager.getByPlayerId(playerId);

      if (!session) {
        continue;
      }

      this.sessionManager.sendToSession(session, "match:snapshot", snapshot);

      const privateState = match.getPrivateStateFor(playerId);

      if (privateState) {
        this.sessionManager.sendToSession(session, "match:privateState", privateState);
      }
    }
  }

  private broadcastToPlayers<TPayload>(playerIds: string[], type: MessageType, payload: TPayload): void {
    for (const playerId of playerIds) {
      const session = this.sessionManager.getByPlayerId(playerId);

      if (session) {
        this.sessionManager.sendToSession(session, type, payload);
      }
    }
  }

  getMatchById(matchId: string): Match | undefined {
    return this.matchesById.get(matchId);
  }

  private requireMatch(session: Session): Match | undefined {
    return session.matchId ? this.matchesById.get(session.matchId) : undefined;
  }

  handleMove(session: Session, targetZoneId: string): MoveResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    return match.move(session.playerId, targetZoneId);
  }

  handleUseAbility(session: Session, targetKind: AbilityTargetKind, targetId: string): AbilityUseResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.useAbility(session.playerId, targetKind, targetId);

    return result.ok ? { ok: true } : result;
  }

  handleSessionConnected(session: Session): void {
    this.requireMatch(session)?.setConnected(session.playerId, true);
  }

  handleSessionDisconnected(session: Session): void {
    this.requireMatch(session)?.setConnected(session.playerId, false);
  }

  // --- Stage E: chat ---

  handleSendGlobalChat(session: Session, text: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.sendGlobalChat(session.playerId, text);

    if (!result.ok) {
      return result;
    }

    this.broadcastToPlayers(match.getPlayerIds(), "match:chat:message", result.value);

    return { ok: true };
  }

  handleSendTeamChat(session: Session, text: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const teamId = match.getTeamIdFor(session.playerId);

    if (!teamId) {
      return { ok: false, reason: "no_team" };
    }

    const result = match.sendTeamChat(session.playerId, text);

    if (!result.ok) {
      return result;
    }

    this.broadcastToPlayers(match.getTeamMemberIds(teamId), "match:chat:message", result.value);

    return { ok: true };
  }

  handleOpenPrivateThread(session: Session, targetPlayerId: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.openPrivateThread(session.playerId, targetPlayerId);

    if (!result.ok) {
      return result;
    }

    this.sessionManager.sendToSession(session, "privateChat:opened", {
      otherPlayerId: targetPlayerId,
      otherNickname: result.value.nickname,
    });

    const targetSession = this.sessionManager.getByPlayerId(targetPlayerId);

    if (targetSession) {
      this.sessionManager.sendToSession(targetSession, "privateChat:opened", {
        otherPlayerId: session.playerId,
        otherNickname: session.nickname,
      });
    }

    return { ok: true };
  }

  handleSendPrivateChat(session: Session, targetPlayerId: string, text: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.sendPrivateChat(session.playerId, targetPlayerId, text);

    if (!result.ok) {
      return result;
    }

    for (const delivery of result.value) {
      const recipientSession = this.sessionManager.getByPlayerId(delivery.recipientPlayerId);

      if (recipientSession) {
        this.sessionManager.sendToSession(recipientSession, "match:chat:message", delivery.message);
      }
    }

    return { ok: true };
  }

  handleSendTraitorChat(session: Session, targetPlayerId: string, text: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.sendTraitorChat(session.playerId, targetPlayerId, text);

    if (!result.ok) {
      return result;
    }

    for (const delivery of result.value) {
      const recipientSession = this.sessionManager.getByPlayerId(delivery.recipientPlayerId);

      if (recipientSession) {
        this.sessionManager.sendToSession(recipientSession, "match:chat:message", delivery.message);
      }
    }

    return { ok: true };
  }

  handleSendSignal(session: Session, targetPlayerId: string): ChatActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    const result = match.sendPrivateSignal(session.playerId, targetPlayerId);

    // No broadcast here - both participants' private state (including
    // signaledByMe/signaledByOther/traitorChannelUnlocked) reflects this on
    // the next tick, at most MATCH_TICK_INTERVAL_MS later.
    return result.ok ? { ok: true } : result;
  }

  // --- Stage F: the key ---

  handleTransferKey(session: Session, targetPlayerId: string): KeyTransferActionResult {
    const match = this.requireMatch(session);

    if (!match) {
      return { ok: false, reason: "not_in_match" };
    }

    return match.transferKey(session.playerId, targetPlayerId);
  }
}
