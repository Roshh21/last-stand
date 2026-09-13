import { useState, type FormEvent } from "react";

import { gameClient, useGameClient } from "../net/useGameClient.js";

interface ReportPlayerModalProps {
  targetPlayerId: string;
  targetNickname: string;
  onClose: () => void;
}

export function ReportPlayerModal({ targetPlayerId, targetNickname, onClose }: ReportPlayerModalProps) {
  const state = useGameClient();
  const [reason, setReason] = useState("");

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    if (!reason.trim()) {
      return;
    }

    gameClient.reportPlayer({ targetPlayerId, reason: reason.trim() });
  }

  function handleClose(): void {
    gameClient.resetReportStatus();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Report {targetNickname}</h2>
          <button className="icon-button" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        {state.reportStatus === "sent" ? (
          <div>
            <p>Thanks - that's been recorded.</p>
            <button className="button primary" onClick={handleClose} style={{ marginTop: 14 }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="report-reason">What happened?</label>
              <textarea
                id="report-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="button primary"
              disabled={state.reportStatus === "sending" || !reason.trim()}
            >
              {state.reportStatus === "sending" ? "Sending…" : "Submit report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
