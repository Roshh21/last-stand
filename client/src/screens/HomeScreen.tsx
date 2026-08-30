import { ROUTES, useRouter } from "../router/Router.js";

export function HomeScreen() {
  const { navigate } = useRouter();

  return (
    <div className="home-hero">
      <h1>Last Stand</h1>
      <p>Everyone may need each other, but ultimately only one person wins.</p>
      <div className="button-row" style={{ justifyContent: "center", marginTop: 24 }}>
        <button className="button primary" onClick={() => navigate(ROUTES.island)}>
          Play
        </button>
        <button className="button" onClick={() => navigate(ROUTES.games)}>
          Browse games
        </button>
      </div>
    </div>
  );
}
