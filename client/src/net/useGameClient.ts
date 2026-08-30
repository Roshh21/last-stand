import { useSyncExternalStore } from "react";

import type { ClientState } from "./GameClient.js";
import { GameClient } from "./GameClient.js";

/** One GameClient (one WebSocket) for the lifetime of the app. */
export const gameClient = new GameClient();

export function useGameClient(): ClientState {
  return useSyncExternalStore(gameClient.subscribe, gameClient.getSnapshot);
}
