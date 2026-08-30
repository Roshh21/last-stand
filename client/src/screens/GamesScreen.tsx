import { ROUTES, useRouter } from "../router/Router.js";

export function GamesScreen() {
  const { navigate } = useRouter();

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Games</h2>
      <div className="game-grid">
        <div className="card game-card">
          <h3>Island</h3>
          <p className="subtitle">20-50 players. Survival, tasks, and a hidden traitor.</p>
          <button className="button primary" onClick={() => navigate(ROUTES.island)}>
            Play Island
          </button>
        </div>

        <div className="card game-card disabled">
          <h3>Color Code</h3>
          <p className="subtitle">More games coming soon.</p>
          <button className="button" disabled>
            Coming soon
          </button>
        </div>

        <div className="card game-card disabled">
          <h3>Hidden Objective</h3>
          <p className="subtitle">More games coming soon.</p>
          <button className="button" disabled>
            Coming soon
          </button>
        </div>
      </div>
    </div>
  );
}
