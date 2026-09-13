import {
  ISLAND_MAP,
  getAbility,
  getZoneById,
  type AbilityRejectReason,
  type AbilityRejectedPayload,
  type MatchPlayerState,
} from "@last-stand/shared";

import type { AbilityLogEntry } from "../net/GameClient.js";
import { gameClient } from "../net/useGameClient.js";

function describeAbilityRejection(reason: AbilityRejectReason): string {
  switch (reason) {
    case "on_cooldown":
      return "still recovering from the last use.";
    case "no_zone_effect":
      return "this element has no effect on paths - try it on a task instead.";
    case "invalid_target":
      return "that's not a real target.";
    case "target_not_here":
      return "you need to be there (or right next to it) to do that.";
    case "needs_more_players":
      return "not enough people here working together yet.";
    case "task_already_complete":
      return "that task is already done.";
    case "match_not_in_progress":
      return "the match isn't in progress right now.";
    case "not_in_match":
      return "you're not part of this match.";
    default:
      return "something went wrong.";
  }
}

interface AbilityPanelProps {
  me: MatchPlayerState;
  now: number;
  lastRejection: AbilityRejectedPayload | null;
  log: AbilityLogEntry[];
}

export function AbilityPanel({ me, now, lastRejection, log }: AbilityPanelProps) {
  const ability = getAbility(me.element);
  const onCooldown = now < me.abilityReadyAt;
  const secondsLeft = Math.max(0, Math.ceil((me.abilityReadyAt - now) / 1000));

  return (
    <div className="card ability-panel">
      <h3>
        {ability.label} <span className="hint-text">({getZoneById(ISLAND_MAP, me.zoneId)?.name})</span>
      </h3>

      {ability.canTargetZone ? (
        <>
          <p className="subtitle">{ability.zoneEffectDescription}</p>
          <button
            className="button primary"
            disabled={onCooldown}
            onClick={() => gameClient.useAbility("zone", me.zoneId)}
          >
            {onCooldown ? `Recharging (${secondsLeft}s)` : "Use on this path"}
          </button>
        </>
      ) : (
        <p className="hint-text">{ability.taskEffectDescription}</p>
      )}

      {lastRejection && (
        <p className="move-rejection">Couldn't do that: {describeAbilityRejection(lastRejection.reason)}</p>
      )}

      <div className="ability-log">
        <p className="ability-log-title">Recent activity</p>
        {log.length === 0 && <p className="chat-empty">Nothing yet.</p>}
        {[...log]
          .slice(-6)
          .reverse()
          .map((entry) => {
            const zoneName = getZoneById(ISLAND_MAP, entry.zoneId)?.name ?? entry.zoneId;
            const elementLabel = getAbility(entry.element).label;

            return (
              <p key={entry.id} className="ability-log-line">
                Someone used <strong>{elementLabel}</strong> in {zoneName}.
              </p>
            );
          })}
      </div>
    </div>
  );
}
