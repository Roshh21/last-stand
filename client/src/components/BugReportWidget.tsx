import { useState, type FormEvent } from "react";

import { gameClient, useGameClient } from "../net/useGameClient.js";

export function BugReportWidget() {
  const state = useGameClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [whatWasHappening, setWhatWasHappening] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();

    if (!description.trim()) {
      return;
    }

    gameClient.submitBugReport({
      description: description.trim(),
      whatWasHappening: whatWasHappening.trim(),
      expectedResult: expectedResult.trim(),
      actualResult: actualResult.trim(),
    });
  }

  function handleClose(): void {
    setOpen(false);
    gameClient.resetBugReportStatus();
    setDescription("");
    setWhatWasHappening("");
    setExpectedResult("");
    setActualResult("");
  }

  return (
    <>
      <div className="bug-report-trigger">
        <button className="button" onClick={() => setOpen(true)}>
          Report a bug
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Report a bug</h2>
              <button className="icon-button" onClick={handleClose} aria-label="Close">
                ×
              </button>
            </div>

            {state.bugReportStatus === "sent" ? (
              <div>
                <p>Thanks - that's been recorded, with your version, browser, and current match attached automatically.</p>
                <button className="button primary" onClick={handleClose} style={{ marginTop: 14 }}>
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="bug-description">What went wrong?</label>
                  <textarea
                    id="bug-description"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="bug-context">What were you doing?</label>
                  <textarea
                    id="bug-context"
                    rows={2}
                    value={whatWasHappening}
                    onChange={(event) => setWhatWasHappening(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="bug-expected">What did you expect to happen?</label>
                  <textarea
                    id="bug-expected"
                    rows={2}
                    value={expectedResult}
                    onChange={(event) => setExpectedResult(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="bug-actual">What actually happened?</label>
                  <textarea
                    id="bug-actual"
                    rows={2}
                    value={actualResult}
                    onChange={(event) => setActualResult(event.target.value)}
                  />
                </div>

                {state.bugReportStatus === "error" && (
                  <p className="error-text">{state.bugReportError ?? "Something went wrong."}</p>
                )}

                <button
                  type="submit"
                  className="button primary"
                  disabled={state.bugReportStatus === "sending" || !description.trim()}
                >
                  {state.bugReportStatus === "sending" ? "Sending…" : "Submit report"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
