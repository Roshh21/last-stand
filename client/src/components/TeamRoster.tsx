import type { MatchPlayerState, TeamStateDTO } from "@last-stand/shared";

interface TeamRosterProps {
  teams: TeamStateDTO[];
  players: MatchPlayerState[];
}

/** P29: "display team rosters clearly to all players (public information)." */
export function TeamRoster({ teams, players }: TeamRosterProps) {
  return (
    <div className="team-roster-grid">
      {teams.map((team) => (
        <div key={team.id} className="team-roster-card" style={{ borderColor: team.color }}>
          <p className="team-roster-name" style={{ color: team.color }}>
            {team.name}
          </p>
          <ul className="team-roster-members">
            {players
              .filter((player) => player.teamId === team.id)
              .map((player) => (
                <li key={player.playerId} data-connected={player.connected}>
                  {player.nickname}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
