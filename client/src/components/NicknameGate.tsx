import { useState, type FormEvent } from "react";

import { isValidNickname, sanitizeNickname } from "@last-stand/shared";

import { gameClient } from "../net/useGameClient.js";

export function NicknameGate() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    const clean = sanitizeNickname(value);

    if (!isValidNickname(clean)) {
      setError("Nicknames are 2-20 characters.");

      return;
    }

    setError(null);
    gameClient.chooseNickname(clean);
  }

  return (
    <div className="card">
      <h2>Choose a nickname</h2>
      <p className="subtitle">Other players will see this. You can change it later in Settings.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="nickname">Nickname</label>
          <input
            id="nickname"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={20}
            autoFocus
            placeholder="Castaway42"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="button primary">
          Continue
        </button>
      </form>
    </div>
  );
}
