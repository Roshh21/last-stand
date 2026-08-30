import { createApp } from "./app.js";
import { APP_VERSION, PORT } from "./config.js";

const { httpServer, wss } = createApp();

wss.on("connection", (socket) => {
  console.log(`[ws] connection opened. total sockets: ${wss.clients.size}`);

  socket.on("close", () => {
    console.log(`[ws] connection closed. total sockets: ${wss.clients.size}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Last Stand server v${APP_VERSION} running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
