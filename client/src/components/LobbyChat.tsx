import { useState, type FormEvent } from "react";

import { useGameClient, gameClient } from "../net/useGameClient.js";

export function LobbyChat() {
  const state = useGameClient();
  const [text, setText] = useState("");

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    const trimmed = text.trim();

    if (trimmed) {
      gameClient.sendChat(trimmed);
      setText("");
    }
  }

  return (
    <div>
      <div className="chat-log">
        {state.lobbyChat.length === 0 && <p className="chat-empty">No messages yet.</p>}
        {state.lobbyChat.map((message) => (
          <p key={message.id} className="chat-line">
            <span className="who">{message.nickname}</span>
            {message.text}
          </p>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Say something to the lobby…"
          maxLength={280}
        />
        <button type="submit" className="button">
          Send
        </button>
      </form>
    </div>
  );
}
