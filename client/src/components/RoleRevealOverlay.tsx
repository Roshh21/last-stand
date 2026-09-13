import { useState } from "react";

import type { PlayerRole } from "@last-stand/shared";

interface RoleRevealOverlayProps {
  matchId: string;
  role: PlayerRole;
}

/** Shown once per match, right when the player's private state first arrives (P30). */
export function RoleRevealOverlay({ matchId, role }: RoleRevealOverlayProps) {
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (dismissedFor === matchId) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className={`role-reveal role-reveal-${role}`}>
        <p className="role-reveal-kicker">Your role this match</p>
        <h1>{role === "traitor" ? "You are a Traitor" : "You are Loyal"}</h1>
        <p className="role-reveal-body">
          {role === "traitor"
            ? "Blend in, complete tasks convincingly, and work against the team without ever being caught."
            : "Work with your team to complete every task - and watch for anyone whose help doesn't quite add up."}
        </p>
        <button className="button primary" onClick={() => setDismissedFor(matchId)}>
          Got it
        </button>
      </div>
    </div>
  );
}
