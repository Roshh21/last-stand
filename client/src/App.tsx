import { useEffect } from "react";

import "./App.css";
import { AppShell } from "./layout/AppShell.js";
import { gameClient, useGameClient } from "./net/useGameClient.js";
import { ROUTES, RouterProvider, useRouter } from "./router/Router.js";
import { GamesScreen } from "./screens/GamesScreen.js";
import { HomeScreen } from "./screens/HomeScreen.js";
import { IslandScreen } from "./screens/IslandScreen.js";
import { PlaceholderScreen } from "./screens/PlaceholderScreen.js";
import { SettingsScreen } from "./screens/SettingsScreen.js";

function Screens() {
  const { path, navigate } = useRouter();
  const state = useGameClient();

  // After a reconnect, if the server says we're still in a room/match,
  // jump straight back to Island rather than leaving the person on
  // whatever static screen they refreshed from (P7).
  useEffect(() => {
    if (state.resumeSequence === 0) {
      return;
    }

    if (state.location.type === "room" || state.location.type === "match") {
      navigate(ROUTES.island);
    }
    // Only re-run when a *new* resume happens, not on every location change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.resumeSequence]);

  switch (path) {
    case ROUTES.games:
      return <GamesScreen />;

    case ROUTES.island:
      return <IslandScreen />;

    case ROUTES.friends:
      return <PlaceholderScreen title="Friends" />;

    case ROUTES.profile:
      return <PlaceholderScreen title="Profile" />;

    case ROUTES.settings:
      return <SettingsScreen />;

    case ROUTES.home:
    default:
      return <HomeScreen />;
  }
}

function App() {
  useEffect(() => {
    gameClient.connect();

    return () => gameClient.disconnect();
  }, []);

  return (
    <RouterProvider>
      <AppShell>
        <Screens />
      </AppShell>
    </RouterProvider>
  );
}

export default App;
