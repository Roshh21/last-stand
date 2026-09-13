import { lazy, Suspense } from "react";

import {
  ISLAND_MAP,
  getElement,
  getZoneById,
  type AbilityRejectedPayload,
  type MatchSnapshotDTO,
  type MoveRejectReason,
  type MoveRejectedPayload,
  type PrivateMatchStateDTO,
  type SessionInfoDTO,
} from "@last-stand/shared";

import type { AbilityLogEntry } from "../net/GameClient.js";
import { gameClient } from "../net/useGameClient.js";
import { useNow } from "../net/useNow.js";
const IslandScene3D = lazy(() =>
  import("../three/IslandScene3D.js").then((module) => ({ default: module.IslandScene3D })),
);
import { AbilityPanel } from "./AbilityPanel.js";
import { ElementBadge } from "./ElementBadge.js";
import { KeyBadge } from "./KeyBadge.js";
import { MatchChatPanel } from "./MatchChatPanel.js";
import { ObjectiveMeter } from "./ObjectiveMeter.js";
import { RoleRevealOverlay } from "./RoleRevealOverlay.js";
import { RosterList, type RosterEntry } from "./RosterList.js";
import { TaskCard } from "./TaskCard.js";
import { TeamRoster } from "./TeamRoster.js";

function describeRejection(reason: MoveRejectReason): string {
  switch (reason) {
    case "on_cooldown":
      return "still catching your breath from the last move.";
    case "not_adjacent":
      return "that zone isn't connected to where you are.";
    case "unknown_zone":
      return "that's not a real place.";
    case "already_in_zone":
      return "you're already there.";
    case "zone_blocked":
      return "that path is currently blocked.";
    case "match_not_in_progress":
      return "the match isn't in progress right now.";
    case "not_in_match":
      return "you're not part of this match.";
    default:
      return "something went wrong.";
  }
}

interface IslandMatchProps {
  match: MatchSnapshotDTO;
  session: SessionInfoDTO;
  privateState: PrivateMatchStateDTO | null;
  lastMoveRejection: MoveRejectedPayload | null;
  lastAbilityRejection: AbilityRejectedPayload | null;
  abilityLog: AbilityLogEntry[];
}

export function IslandMatch({
  match,
  session,
  privateState,
  lastMoveRejection,
  lastAbilityRejection,
  abilityLog,
}: IslandMatchProps) {
  const now = useNow(200);
  const secondsLeft = match.status === "starting" ? Math.max(0, Math.ceil(((match.startsAt ?? now) - now) / 1000)) : 0;

  if (match.status === "starting") {
    return (
      <div className="card countdown-banner">
        <h2>Get ready…</h2>
        <span className="countdown-number">{secondsLeft}</span>
      </div>
    );
  }

  if (match.status === "ended") {
    return (
      <div className="card countdown-banner">
        <h2>Match ended</h2>
        <p className="subtitle">
          Everyone disconnected. (Real win conditions and a results screen arrive in a later stage.)
        </p>
      </div>
    );
  }

  const me = match.players.find((player) => player.playerId === session.playerId);
  const onMoveCooldown = me ? now < me.movementReadyAt : false;
  const onAbilityCooldown = me ? now < me.abilityReadyAt : false;
  const tasksHere = me ? match.tasks.filter((task) => task.zoneId === me.zoneId) : [];
  const myTeam = match.teams.find((team) => team.id === me?.teamId);

  const entries: RosterEntry[] = match.players.map((player) => {
    const team = match.teams.find((t) => t.id === player.teamId);

    return {
      playerId: player.playerId,
      nickname: player.nickname,
      connected: player.connected,
      avatar: player.avatar,
      badges: [
        ...(team ? [{ label: team.name }] : []),
        { label: getElement(player.element).name },
        { label: getZoneById(ISLAND_MAP, player.zoneId)?.name ?? player.zoneId },
        ...(player.connected ? [] : [{ label: "Disconnected", kind: "disconnected" as const }]),
      ],
    };
  });

  return (
    <div className="match-layout">
      {privateState && <RoleRevealOverlay matchId={match.matchId} role={privateState.role} />}

      <div className="card">
        <div className="island-header">
          <h2>Island</h2>
          <div className="button-row">
            {me && <ElementBadge element={me.element} />}
            {myTeam && (
              <span className="team-chip" style={{ borderColor: myTeam.color, color: myTeam.color }}>
                {myTeam.name}
              </span>
            )}
          </div>
        </div>

        <ObjectiveMeter objective={match.objective} />

        <p className="subtitle" style={{ marginTop: 14 }}>
          {me ? `You're in ${getZoneById(ISLAND_MAP, me.zoneId)?.name}.` : "You're spectating."}
          {onMoveCooldown && " Catching your breath before you can move again…"}
        </p>

        <Suspense fallback={<div className="island-3d-canvas island-3d-loading">Loading the island…</div>}>
          <IslandScene3D
            players={match.players}
            zones={match.zones}
            tasks={match.tasks}
            myPlayerId={session.playerId}
            canMove={!onMoveCooldown}
            abilityLog={abilityLog}
            onZoneClick={(zoneId) => gameClient.move(zoneId)}
          />
        </Suspense>

        {lastMoveRejection && (
          <p className="move-rejection">Can't move there: {describeRejection(lastMoveRejection.reason)}</p>
        )}
      </div>

      {me && <AbilityPanel me={me} now={now} lastRejection={lastAbilityRejection} log={abilityLog} />}

      {privateState?.hasKey && privateState.keyContent && <KeyBadge keyContent={privateState.keyContent} />}

      {me && tasksHere.length > 0 && (
        <div className="card">
          <h3>Tasks here</h3>
          <div className="task-list">
            {tasksHere.map((task) => (
              <TaskCard key={task.id} task={task} myElement={me.element} onCooldown={onAbilityCooldown} />
            ))}
          </div>
        </div>
      )}

      <MatchChatPanel session={session} players={match.players} />

      <div className="card">
        <h3>Teams</h3>
        <TeamRoster teams={match.teams} players={match.players} />
      </div>

      <div className="card">
        <h2>Roster</h2>
        <RosterList entries={entries} />
      </div>
    </div>
  );
}
