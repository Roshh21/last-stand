import { useState } from "react";

import { isValidNickname, sanitizeNickname } from "@last-stand/shared";

import { gameClient, useGameClient } from "../net/useGameClient.js";

export function SettingsScreen() {
  const state = useGameClient();
  const [nickname, setNickname] = useState("");
  const [saved, setSaved] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  function handleChooseNickname(): void {
    const clean = sanitizeNickname(nickname);

    if (isValidNickname(clean)) {
      gameClient.chooseNickname(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Settings</h2>

      <div className="card">
        <h3>Display name</h3>
        {state.session ? (
          <>
            <p className="subtitle" style={{ marginTop: 10 }}>
              Playing as <strong>{state.session.nickname}</strong>.
            </p>
            <p className="hint-text">
              Nicknames are tied to your current session. Clear this browser's storage (or use a different
              browser) to start over with a new one.
            </p>
          </>
        ) : (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="settings-nickname">Nickname</label>
            <div className="button-row">
              <input
                id="settings-nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={20}
              />
              <button className="button primary" onClick={handleChooseNickname}>
                Save
              </button>
            </div>
            {saved && <p className="hint-text">Saved.</p>}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Audio</h3>
        <p className="subtitle">Placeholder - sound design comes later.</p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={audioEnabled}
            onChange={(event) => setAudioEnabled(event.target.checked)}
          />
          Sound effects enabled
        </label>
      </div>

      <div className="card">
        <h3>Accessibility</h3>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          Reduce motion
        </label>
      </div>
    </div>
  );
}
