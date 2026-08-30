import { createServer, type Server } from "node:http";

import { WebSocketServer } from "ws";

import { BugReportStore } from "./bugReports/BugReportStore.js";
import { APP_VERSION } from "./config.js";
import { MatchManager } from "./match/MatchManager.js";
import { RoomManager } from "./rooms/RoomManager.js";
import type { RouterContext } from "./routing/context.js";
import type { Session } from "./session/types.js";
import { SessionManager } from "./session/SessionManager.js";
import { ConnectionManager } from "./ws/ConnectionManager.js";

export interface App {
  httpServer: Server;
  wss: WebSocketServer;
  ctx: RouterContext;
}

/** Builds the full server (HTTP health check + WS + all managers) without binding to a port. */
export function createApp(): App {
  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });

    res.end(
      JSON.stringify({
        status: "ok",
        service: "last-stand-server",
        version: APP_VERSION,
      }),
    );
  });

  const wss = new WebSocketServer({ server: httpServer });

  const sessionManager = new SessionManager();
  const roomManager = new RoomManager(sessionManager);
  const matchManager = new MatchManager(sessionManager);
  const bugReportStore = new BugReportStore();

  const ctx: RouterContext = { sessionManager, roomManager, matchManager, bugReportStore };
  const connectionManager = new ConnectionManager(ctx);

  function broadcastRoomStateIfInRoom(session: Session): void {
    const room = roomManager.getRoomForSession(session);

    if (room) {
      roomManager.broadcast(room, "room:state", roomManager.toDTO(room));
    }
  }

  // A socket dropping doesn't remove a player outright - it starts a grace
  // period (P7). Other players in the same room/match should still see the
  // connection-status change immediately.
  sessionManager.on("disconnected", (session: Session) => {
    broadcastRoomStateIfInRoom(session);
    matchManager.handleSessionDisconnected(session);
  });

  sessionManager.on("reconnected", (session: Session) => {
    broadcastRoomStateIfInRoom(session);
    matchManager.handleSessionConnected(session);
  });

  // Grace period elapsed with no reconnect: a lobby player is fully removed
  // (their slot frees up); a match player is left in place, permanently
  // disconnected - matches don't have a "leave" concept yet.
  sessionManager.on("expired", (session: Session) => {
    const room = roomManager.removeFromRoom(session);

    if (room) {
      roomManager.broadcast(room, "room:state", roomManager.toDTO(room));
    }
  });

  wss.on("connection", (socket, request) => {
    connectionManager.handleConnection(socket, request);
  });

  return { httpServer, wss, ctx };
}
