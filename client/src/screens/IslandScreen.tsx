import { IslandMatch } from "../components/IslandMatch.js";
import { NicknameGate } from "../components/NicknameGate.js";
import { RoomLobby } from "../components/RoomLobby.js";
import { useGameClient } from "../net/useGameClient.js";

export function IslandScreen() {
  const state = useGameClient();

  if (state.connectionStatus === "connecting" && !state.session) {
    return (
      <div className="card">
        <h2>Connecting…</h2>
        <p className="subtitle">Setting up a connection to the server.</p>
      </div>
    );
  }

  if (!state.session || state.needsNickname) {
    return <NicknameGate />;
  }

  if (state.location.type === "match") {
    if (!state.match) {
      return (
        <div className="card">
          <h2>Rejoining match…</h2>
        </div>
      );
    }

    return (
      <IslandMatch match={state.match} session={state.session} lastMoveRejection={state.lastMoveRejection} />
    );
  }

  return <RoomLobby room={state.room} session={state.session} roomError={state.roomError?.message ?? null} />;
}
