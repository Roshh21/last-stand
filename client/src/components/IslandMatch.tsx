import {
  ISLAND_MAP,
  getZoneById,
  type MatchSnapshotDTO,
  type MoveRejectReason,
  type MoveRejectedPayload,
  type SessionInfoDTO,
} from "@last-stand/shared";

import { gameClient } from "../net/useGameClient.js";
import { useNow } from "../net/useNow.js";
import { IslandMapSvg } from "./IslandMapSvg.js";
import { RosterList, type RosterEntry } from "./RosterList.js";

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
  lastMoveRejection: MoveRejectedPayload | null;
}

export function IslandMatch({ match, session, lastMoveRejection }: IslandMatchProps) {
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
  const onCooldown = me ? now < me.movementReadyAt : false;

  const entries: RosterEntry[] = match.players.map((player) => ({
    playerId: player.playerId,
    nickname: player.nickname,
    connected: player.connected,
    avatar: player.avatar,
    badges: [
      { label: getZoneById(ISLAND_MAP, player.zoneId)?.name ?? player.zoneId },
      ...(player.connected ? [] : [{ label: "Disconnected", kind: "disconnected" as const }]),
    ],
  }));

  return (
    <div className="match-layout">
      <div className="card">
        <h2>Island</h2>
        <p className="subtitle">
          {me ? `You're in ${getZoneById(ISLAND_MAP, me.zoneId)?.name}.` : "You're spectating."}
          {onCooldown && " Catching your breath before you can move again…"}
        </p>

        <IslandMapSvg
          players={match.players}
          myPlayerId={session.playerId}
          canMove={!onCooldown}
          onZoneClick={(zoneId) => gameClient.move(zoneId)}
        />

        {lastMoveRejection && (
          <p className="move-rejection">Can't move there: {describeRejection(lastMoveRejection.reason)}</p>
        )}
      </div>

      <div className="card">
        <h2>Roster</h2>
        <RosterList entries={entries} />
      </div>
    </div>
  );
}
