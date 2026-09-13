import { EventEmitter } from "node:events";

import {
  ABILITY_COOLDOWN_MS,
  ISLAND_MAP,
  MATCH_START_COUNTDOWN_MS,
  MATCH_TICK_INTERVAL_MS,
  MOVEMENT_COOLDOWN_MS,
  TASK_DEFINITIONS,
  getAbility,
  getRequiredObjectiveTaskCount,
  getStartZoneId,
  isValidZoneId,
  isZoneAdjacent,
  type AbilityRejectReason,
  type AbilityTargetKind,
  type ElementId,
  type KeyTransferRejectReason,
  type MatchPlayerState,
  type MatchSnapshotDTO,
  type MatchStatus,
  type MoveRejectReason,
  type PlayerRole,
  type PrivateMatchStateDTO,
  type TaskDefinition,
  type TaskStateDTO,
  type TeamStateDTO,
  type ZoneRuntimeStateDTO,
} from "@last-stand/shared";

import { generateMatchId } from "../utils/id.js";
import { assignInitialKey } from "./key.js";
import { buildAvatar } from "./avatar.js";
import { assignElements } from "./elements.js";
import { MatchChat, type ChatDelivery, type ChatPlayerInfo, type ChatResult } from "./MatchChat.js";
import { checkMove } from "./movement.js";
import { assignRoles } from "./roles.js";
import { checkCooperativeRequirement, resolveTaskContribution } from "./taskContribution.js";
import { assignTeams } from "./teams.js";

export interface MatchPlayerInit {
  playerId: string;
  nickname: string;
}

export type MoveResult = { ok: true } | { ok: false; reason: MoveRejectReason };

export type AbilityUseResult =
  | { ok: true; element: ElementId; zoneId: string }
  | { ok: false; reason: AbilityRejectReason };

export type KeyTransferResult = { ok: true } | { ok: false; reason: KeyTransferRejectReason };

interface TaskContributionLogEntry {
  playerId: string;
  element: ElementId;
  isSaboteur: boolean;
  progressDelta: number;
  instabilityDelta: number;
  timestamp: number;
}

interface TaskRuntimeState {
  definition: TaskDefinition;
  progress: number;
  completed: boolean;
  /** Never serialized to any client (P22: "never let the client receive a flag that says this was sabotage"). */
  instability: number;
  /** Server-internal only, for Stage H's future accusation mechanics (P22). */
  contributionLog: TaskContributionLogEntry[];
}

/**
 * The authoritative in-game state machine (P8), extended with the world/
 * movement layer (Stage B), elements & abilities (Stage C), tasks (Stage D),
 * communication (Stage E), and teams/hidden roles/the key (Stage F).
 *
 * The single most important architectural fact about this class: it
 * produces TWO different views of the match. `getSnapshot()` is public -
 * broadcast identically to everyone, and must never contain a role, key
 * content, or chat content that isn't global/team. `getPrivateStateFor()`
 * is personal - computed fresh per player, sent only to that one player.
 * See docs/security-audit.md for how this separation is verified.
 *
 * Status machine: "starting" (short countdown) -> "in_progress" -> "ended"
 * (currently only reached if every player disconnects - real win conditions
 * are Stage I, far later in the roadmap).
 */
export class Match extends EventEmitter {
  readonly matchId: string;
  readonly originRoomCode: string | null;
  readonly map = ISLAND_MAP;
  readonly taskDefinitions = TASK_DEFINITIONS;
  readonly teams: TeamStateDTO[];

  status: MatchStatus = "starting";
  private readonly countdownEndsAt: number;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly players = new Map<string, MatchPlayerState>();
  private readonly zoneBlocked = new Map<string, boolean>();
  private readonly tasks = new Map<string, TaskRuntimeState>();

  // --- Stage F: hidden roles & the key ---
  private readonly roles = new Map<string, PlayerRole>();
  private keyHolderId: string;
  private readonly keyContent: string;
  private readonly keyTransferHistory: Array<{ fromId: string; toId: string; at: number }> = [];

  // --- Stage E: chat ---
  private readonly chat: MatchChat;

  constructor(params: { playerInits: MatchPlayerInit[]; originRoomCode: string | null }) {
    super();

    this.matchId = generateMatchId();
    this.originRoomCode = params.originRoomCode;
    this.countdownEndsAt = Date.now() + MATCH_START_COUNTDOWN_MS;

    const playerIds = params.playerInits.map((init) => init.playerId);
    const startZoneId = getStartZoneId(this.map);
    const elementAssignments = assignElements(playerIds);
    const { teams, assignments: teamAssignments } = assignTeams(playerIds);

    this.teams = teams;
    this.roles = assignRoles(teamAssignments);

    for (const init of params.playerInits) {
      const element = elementAssignments.get(init.playerId)!;
      const teamId = teamAssignments.get(init.playerId)!;

      this.players.set(init.playerId, {
        playerId: init.playerId,
        nickname: init.nickname,
        connected: true,
        spectator: false,
        avatar: buildAvatar(init.playerId, element),
        zoneId: startZoneId,
        movement: null,
        movementReadyAt: 0,
        element,
        abilityReadyAt: 0,
        teamId,
      });
    }

    for (const definition of this.taskDefinitions) {
      this.tasks.set(definition.id, {
        definition,
        progress: 0,
        completed: false,
        instability: 0,
        contributionLog: [],
      });
    }

    const traitorIds = playerIds.filter((playerId) => this.roles.get(playerId) === "traitor");
    const keyAssignment = assignInitialKey(traitorIds);

    this.keyHolderId = keyAssignment.holderId;
    this.keyContent = keyAssignment.content;

    this.chat = new MatchChat((playerId) => this.lookupChatInfo(playerId), playerIds);
  }

  private lookupChatInfo(playerId: string): ChatPlayerInfo | undefined {
    const player = this.players.get(playerId);
    const role = this.roles.get(playerId);

    if (!player || !role) {
      return undefined;
    }

    return { nickname: player.nickname, teamId: player.teamId, connected: player.connected, role };
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

  getTeamIdFor(playerId: string): string | undefined {
    return this.players.get(playerId)?.teamId;
  }

  /** Every player currently on the given team, regardless of connection status. */
  getTeamMemberIds(teamId: string): string[] {
    return [...this.players.values()].filter((player) => player.teamId === teamId).map((p) => p.playerId);
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.players.get(playerId);

    if (!player || player.connected === connected) {
      return;
    }

    player.connected = connected;

    const message = this.chat.postTeamSystemMessage(
      player.teamId,
      `${player.nickname} ${connected ? "reconnected" : "disconnected"}.`,
      Date.now(),
    );

    this.emit("teamChatMessage", { teamId: player.teamId, message });
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
      targetZoneBlocked: this.zoneBlocked.get(targetZoneId) ?? false,
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

  /** Every player currently (this instant) standing in a zone, connected or not - used for map/roster display. */
  private getPlayersInZone(zoneId: string): MatchPlayerState[] {
    return [...this.players.values()].filter((player) => player.zoneId === zoneId);
  }

  /** Only connected players count toward "who's here right now" for cooperative gating (P23). */
  private getConnectedPlayersInZone(zoneId: string): MatchPlayerState[] {
    return this.getPlayersInZone(zoneId).filter((player) => player.connected);
  }

  /**
   * P16-P18: the generic "use ability" pipeline. Every element has exactly
   * one ability in V1, so there's no separate ability-id to validate - the
   * player's own assigned element determines what happens.
   */
  useAbility(playerId: string, targetKind: AbilityTargetKind, targetId: string): AbilityUseResult {
    const player = this.players.get(playerId);

    if (!player) {
      return { ok: false, reason: "not_in_match" };
    }

    if (this.status !== "in_progress") {
      return { ok: false, reason: "match_not_in_progress" };
    }

    const now = Date.now();

    if (now < player.abilityReadyAt) {
      return { ok: false, reason: "on_cooldown" };
    }

    const ability = getAbility(player.element);

    if (targetKind === "zone") {
      return this.useAbilityOnZone(player, ability.canTargetZone, targetId, now);
    }

    return this.useAbilityOnTask(player, targetId, now);
  }

  private useAbilityOnZone(
    player: MatchPlayerState,
    canTargetZone: boolean,
    targetZoneId: string,
    now: number,
  ): AbilityUseResult {
    if (!canTargetZone) {
      return { ok: false, reason: "no_zone_effect" };
    }

    if (!isValidZoneId(this.map, targetZoneId)) {
      return { ok: false, reason: "invalid_target" };
    }

    const isCurrentZone = targetZoneId === player.zoneId;
    const isAdjacentZone = isZoneAdjacent(this.map, player.zoneId, targetZoneId);

    if (!isCurrentZone && !isAdjacentZone) {
      return { ok: false, reason: "target_not_here" };
    }

    const currentlyBlocked = this.zoneBlocked.get(targetZoneId) ?? false;

    this.zoneBlocked.set(targetZoneId, !currentlyBlocked);
    player.abilityReadyAt = now + ABILITY_COOLDOWN_MS;

    this.emit("abilityUsed", { element: player.element, zoneId: player.zoneId });

    return { ok: true, element: player.element, zoneId: player.zoneId };
  }

  private useAbilityOnTask(player: MatchPlayerState, taskId: string, now: number): AbilityUseResult {
    const task = this.tasks.get(taskId);

    if (!task) {
      return { ok: false, reason: "invalid_target" };
    }

    if (task.definition.zoneId !== player.zoneId) {
      return { ok: false, reason: "target_not_here" };
    }

    if (task.completed) {
      return { ok: false, reason: "task_already_complete" };
    }

    const elementsPresent = this.getConnectedPlayersInZone(task.definition.zoneId).map(
      (present) => present.element,
    );
    const cooperativeCheck = checkCooperativeRequirement({ task: task.definition, elementsPresent });

    if (!cooperativeCheck.ok) {
      return { ok: false, reason: "needs_more_players" };
    }

    // Nothing in P15-P24 ever sets a player as a saboteur - see
    // taskContribution.ts and docs/elements-and-abilities.md.
    const isSaboteur = false;
    const contribution = resolveTaskContribution({
      task: task.definition,
      element: player.element,
      isSaboteur,
    });

    task.progress = Math.min(task.definition.completionThreshold, task.progress + contribution.progressDelta);
    task.instability += contribution.instabilityDelta;
    task.completed = task.progress >= task.definition.completionThreshold;
    task.contributionLog.push({
      playerId: player.playerId,
      element: player.element,
      isSaboteur,
      progressDelta: contribution.progressDelta,
      instabilityDelta: contribution.instabilityDelta,
      timestamp: now,
    });

    player.abilityReadyAt = now + ABILITY_COOLDOWN_MS;

    this.emit("abilityUsed", { element: player.element, zoneId: player.zoneId });

    return { ok: true, element: player.element, zoneId: player.zoneId };
  }

  // --- Stage E: chat passthroughs ---

  sendGlobalChat(playerId: string, text: string) {
    return this.chat.sendGlobal(playerId, text, Date.now());
  }

  sendTeamChat(playerId: string, text: string) {
    return this.chat.sendTeam(playerId, text, Date.now());
  }

  openPrivateThread(playerId: string, targetId: string) {
    return this.chat.openThread(playerId, targetId, Date.now());
  }

  sendPrivateChat(playerId: string, targetId: string, text: string): ChatResult<ChatDelivery[]> {
    return this.chat.sendPrivate(playerId, targetId, text, Date.now());
  }

  sendPrivateSignal(playerId: string, targetId: string) {
    return this.chat.sendSignal(playerId, targetId);
  }

  sendTraitorChat(playerId: string, targetId: string, text: string): ChatResult<ChatDelivery[]> {
    return this.chat.sendTraitor(playerId, targetId, text, Date.now());
  }

  getGlobalChatHistory() {
    return this.chat.getGlobalHistory();
  }

  getTeamChatHistory(teamId: string) {
    return this.chat.getTeamHistory(teamId);
  }

  getPrivateThreadHistory(playerId: string, otherPlayerId: string) {
    return this.chat.getThreadHistory(playerId, otherPlayerId);
  }

  // --- Stage F: hidden role & key ---

  getPrivateStateFor(playerId: string): PrivateMatchStateDTO | undefined {
    const player = this.players.get(playerId);
    const role = this.roles.get(playerId);

    if (!player || !role) {
      return undefined;
    }

    const hasKey = this.keyHolderId === playerId;

    return {
      role,
      hasKey,
      keyContent: hasKey ? this.keyContent : null,
      remainingPrivateChatStarts: this.chat.getRemainingStarts(playerId),
      openThreads: this.chat.getPrivateThreadSummaries(playerId),
    };
  }

  /**
   * P32: "usable only inside an active private chat" - and P32's
   * safeguards against duplicating, losing, or handing the key to someone
   * who can't currently receive it. There's no elimination system yet
   * (Stage H) - requiring the target be connected is the closest available
   * analog until "eliminated" is a real state.
   */
  transferKey(playerId: string, targetId: string): KeyTransferResult {
    if (playerId === targetId) {
      return { ok: false, reason: "cannot_message_self" };
    }

    if (this.keyHolderId !== playerId) {
      return { ok: false, reason: "not_key_holder" };
    }

    const target = this.players.get(targetId);

    if (!target) {
      return { ok: false, reason: "target_not_found" };
    }

    if (!target.connected) {
      return { ok: false, reason: "target_disconnected" };
    }

    if (!this.chat.hasOpenThread(playerId, targetId)) {
      return { ok: false, reason: "no_open_thread" };
    }

    this.keyTransferHistory.push({ fromId: playerId, toId: targetId, at: Date.now() });
    this.keyHolderId = targetId;

    return { ok: true };
  }

  private getZoneSnapshots(): ZoneRuntimeStateDTO[] {
    return this.map.zones.map((zone) => ({
      zoneId: zone.id,
      blocked: this.zoneBlocked.get(zone.id) ?? false,
    }));
  }

  private getTaskSnapshots(): TaskStateDTO[] {
    return [...this.tasks.values()].map((task) => ({
      id: task.definition.id,
      zoneId: task.definition.zoneId,
      name: task.definition.name,
      requiredElements: task.definition.requiredElements,
      completionThreshold: task.definition.completionThreshold,
      minContributors: task.definition.minContributors,
      requiredDistinctElements: task.definition.requiredDistinctElements,
      progress: task.progress,
      completed: task.completed,
    }));
  }

  getSnapshot(): MatchSnapshotDTO {
    const taskSnapshots = this.getTaskSnapshots();
    const completedTasks = taskSnapshots.filter((task) => task.completed).length;
    const requiredTasks = getRequiredObjectiveTaskCount(this.taskDefinitions);

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
      teams: this.teams,
      zones: this.getZoneSnapshots(),
      tasks: taskSnapshots,
      objective: {
        completedTasks,
        totalTasks: taskSnapshots.length,
        requiredTasks,
        met: completedTasks >= requiredTasks,
      },
    };
  }
}
