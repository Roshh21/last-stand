import { EventEmitter } from "node:events";

import {
  ISLAND_MAP,
  MATCH_START_COUNTDOWN_MS,
  MATCH_TICK_INTERVAL_MS,
  MOVEMENT_COOLDOWN_MS,
  getStartZoneId,
  type MatchPlayerState,
  type MatchSnapshotDTO,
  type MatchStatus,
  type MoveRejectReason,
} from "@last-stand/shared";

import { generateMatchId } from "../utils/id.js";
import { assignAvatar } from "./avatar.js";
import { checkMove } from "./movement.js";

export interface MatchPlayerInit {
  playerId: string;
  nickname: string;
}

export type MoveResult = { ok: true } | { ok: false; reason: MoveRejectReason };

/**
 * The authoritative in-game state machine (P8), extended with the world/
 * movement layer (Stage B). No real game mechanics live here yet - just the
 * tick loop, player roster, and zone-graph movement everything else in
 * Island builds on top of.
 *
 * Status machine: "starting" (short countdown) -> "in_progress" -> "ended"
 * (currently only reached if every player disconnects - real win conditions
 * are Stage I, far later in the roadmap).
 */
export class Match extends EventEmitter {
  readonly matchId: string;
  readonly originRoomCode: string | null;
  readonly map = ISLAND_MAP;

  status: MatchStatus = "starting";
  private readonly countdownEndsAt: number;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly players = new Map<string, MatchPlayerState>();

  constructor(params: { playerInits: MatchPlayerInit[]; originRoomCode: string | null }) {
    super();

    this.matchId = generateMatchId();
    this.originRoomCode = params.originRoomCode;
    this.countdownEndsAt = Date.now() + MATCH_START_COUNTDOWN_MS;

    const startZoneId = getStartZoneId(this.map);

    for (const init of params.playerInits) {
      this.players.set(init.playerId, {
        playerId: init.playerId,
        nickname: init.nickname,
        connected: true,
        spectator: false,
        avatar: assignAvatar(init.playerId),
        zoneId: startZoneId,
        movement: null,
        movementReadyAt: 0,
      });
    }
  }

  get startsAt(): number {
    return this.countdownEndsAt;
  }

  start(): void {
    if (this.tickTimer) {
      return;
    }

    this.tickTimer = setInterval(() => this.onTick(), MATCH_TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private onTick(): void {
    this.tickCount += 1;

    const now = Date.now();

    if (this.status === "starting" && now >= this.countdownEndsAt) {
      this.status = "in_progress";
    }

    // Movement is applied immediately on request (see move()); this just
    // clears the transient "in transit" flag once its animation window has
    // elapsed, so late-joining clients don't see a stale transition.
    for (const player of this.players.values()) {
      if (player.movement && now >= player.movement.startedAt + player.movement.durationMs) {
        player.movement = null;
      }
    }

    this.emit("tick", this.getSnapshot());

    if (this.status === "in_progress" && this.everyoneDisconnected()) {
      this.status = "ended";
      this.emit("tick", this.getSnapshot());
      this.emit("ended", this.matchId);
      this.stop();
    }
  }

  private everyoneDisconnected(): boolean {
    return [...this.players.values()].every((player) => !player.connected);
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  getPlayerIds(): string[] {
    return [...this.players.keys()];
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);

    if (player) {
      player.connected = connected;
    }
  }

  move(playerId: string, targetZoneId: string): MoveResult {
    const player = this.players.get(playerId);

    if (!player) {
      return { ok: false, reason: "not_in_match" };
    }

    if (this.status !== "in_progress") {
      return { ok: false, reason: "match_not_in_progress" };
    }

    const now = Date.now();
    const result = checkMove({
      map: this.map,
      currentZoneId: player.zoneId,
      targetZoneId,
      movementReadyAt: player.movementReadyAt,
      now,
    });

    if (!result.ok) {
      return result;
    }

    player.movement = {
      fromZoneId: player.zoneId,
      toZoneId: targetZoneId,
      startedAt: now,
      durationMs: MOVEMENT_COOLDOWN_MS,
    };
    player.zoneId = targetZoneId;
    player.movementReadyAt = now + MOVEMENT_COOLDOWN_MS;

    return { ok: true };
  }

  getSnapshot(): MatchSnapshotDTO {
    return {
      matchId: this.matchId,
      status: this.status,
      mapId: this.map.id,
      tick: this.tickCount,
      serverTime: Date.now(),
      startsAt: this.status === "starting" ? this.countdownEndsAt : null,
      players: [...this.players.values()].map((player) => ({
        ...player,
        avatar: { ...player.avatar },
        movement: player.movement ? { ...player.movement } : null,
      })),
    };
  }
}
