import { useState, type FormEvent } from "react";

import { canStartRoom, type RoomStateDTO, type SessionInfoDTO } from "@last-stand/shared";

import { gameClient } from "../net/useGameClient.js";
import { LobbyChat } from "./LobbyChat.js";
import { RosterList, type RosterEntry } from "./RosterList.js";

function CreateOrJoin({ error }: { error: string | null }) {
  const [code, setCode] = useState("");

  function handleJoin(event: FormEvent): void {
    event.preventDefault();

    if (code.trim()) {
      gameClient.joinRoom(code.trim());
    }
  }

  return (
    <div className="card">
      <h2>Island</h2>
      <p className="subtitle">
        A 20-50 player survival &amp; social-deduction game. (The dev lobby currently allows 2-50 for
        testing.)
      </p>

      <div className="button-row">
        <button className="button primary" onClick={() => gameClient.createRoom()}>
          Create a room
        </button>
      </div>

      <form onSubmit={handleJoin} style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="room-code">Or join with a code</label>
          <div className="button-row">
            <input
              id="room-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABCDE"
              maxLength={8}
            />
            <button type="submit" className="button">
              Join
            </button>
          </div>
        </div>
      </form>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function LobbyView({ room, session }: { room: RoomStateDTO; session: SessionInfoDTO }) {
  const me = room.players.find((player) => player.playerId === session.playerId);
  const canStart = canStartRoom(room);

  const entries: RosterEntry[] = room.players.map((player) => ({
    playerId: player.playerId,
    nickname: player.nickname,
    connected: player.connected,
    badges: [
      ...(player.isHost ? [{ label: "Host", kind: "host" as const }] : []),
      player.connected
        ? {
            label: player.ready ? "Ready" : "Not ready",
            kind: player.ready ? ("ready" as const) : undefined,
          }
        : { label: "Disconnected", kind: "disconnected" as const },
    ],
  }));

  return (
    <div className="card">
      <h2>Lobby</h2>
      <p className="subtitle">Share this code so others can join.</p>
      <p className="room-code">{room.code}</p>

      <RosterList entries={entries} />

      <div style={{ marginTop: 16 }}>
        <LobbyChat />
      </div>

      <div className="button-row" style={{ marginTop: 16 }}>
        <button className="button" onClick={() => gameClient.setReady(!me?.ready)} disabled={!me?.connected}>
          {me?.ready ? "Not ready" : "Ready up"}
        </button>

        {me?.isHost && (
          <button className="button primary" onClick={() => gameClient.startGame()} disabled={!canStart}>
            Start game
          </button>
        )}

        <button className="button danger" onClick={() => gameClient.leaveRoom()}>
          Leave
        </button>
      </div>

      {me?.isHost && !canStart && (
        <p className="hint-text" style={{ marginTop: 10 }}>
          Waiting for everyone connected to ready up (at least {room.minPlayers} players).
        </p>
      )}
    </div>
  );
}

interface RoomLobbyProps {
  room: RoomStateDTO | null;
  session: SessionInfoDTO;
  roomError: string | null;
}

export function RoomLobby({ room, session, roomError }: RoomLobbyProps) {
  if (!room) {
    return <CreateOrJoin error={roomError} />;
  }

  return <LobbyView room={room} session={session} />;
}
