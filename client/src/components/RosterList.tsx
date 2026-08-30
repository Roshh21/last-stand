import type { PlayerAvatar } from "@last-stand/shared";

import { Avatar } from "./Avatar.js";

export interface RosterBadge {
  label: string;
  kind?: "host" | "ready" | "disconnected";
}

export interface RosterEntry {
  playerId: string;
  nickname: string;
  connected: boolean;
  avatar?: PlayerAvatar;
  badges?: RosterBadge[];
}

export function RosterList({ entries }: { entries: RosterEntry[] }) {
  return (
    <ul className="roster-list">
      {entries.map((entry) => (
        <li key={entry.playerId} className="roster-item" data-connected={entry.connected}>
          {entry.avatar && <Avatar avatar={entry.avatar} />}
          <span className="name">{entry.nickname}</span>
          {entry.badges?.map((badge) => (
            <span key={badge.label} className={`badge ${badge.kind ?? ""}`}>
              {badge.label}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
