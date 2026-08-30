# Last Stand 2D

An original 2D multiplayer prototype of **Last Stand**, a real-time
multiplayer social-strategy game where players work together to complete
objectives while hidden traitors secretly work against them.

> **"Everyone may need each other, but ultimately only one person wins."**

## Current Status

**v0.3 — Walkable World Prototype**

This repository contains the **original 2D prototype of Last Stand**.

The current prototype has a working multiplayer foundation, including:

- Client-server communication
- Real-time WebSocket connections
- Room creation and room-code based joining
- Real-time multiplayer lobbies
- Persistent player sessions across reconnects
- Authoritative server-side game state
- A connected 2D island/world map
- Server-validated player movement
- Multiple players visible within the shared world
- Initial game UI and player/world state

This prototype was built to validate the multiplayer architecture and
core game concept before the main Last Stand project evolved into a
**Unity-based 3D game**.

The 2D version is maintained as an independent prototype and may continue
to evolve separately from the main 3D game.

## Quick Start

Requires **Node.js (LTS)** and **pnpm**.

```bash
pnpm install
pnpm dev
```

This starts the client and server together.

Client: http://localhost:5173
Server: ws://localhost:3000

Open the client in two browser tabs to test the multiplayer flow:

Create a room in one tab.
Copy the generated room code.
Join the room from the second tab.
Move around the shared world and observe the synchronized player state.

## Other useful commands:

```
pnpm typecheck   # Type-check every package
pnpm test        # Run shared + server test suites
pnpm build     # Production build of client and server 
```

The prototype uses a client-server architecture with the server
responsible for authoritative multiplayer state.

```
Browser Client
      │
      │ WebSocket
      ▼
Node.js Game Server
      │
      ▼
Shared Game Logic
Project Structure
/client    React + TypeScript + Vite - browser client
/server    Node + TypeScript - multiplayer game server
/shared    Types, constants, and shared game logic
/games     Reserved for future standalone games
/docs      Architecture and design notes
Evolution of Last Stand
```

This 2D prototype represents the earlier stage of the Last Stand project.

The main game is now being developed separately as a 3D Unity
experience, while this repository preserves the original browser-based
multiplayer implementation and experimentation.

The 2D prototype helped establish the multiplayer foundation and validate
the core concept before moving toward the larger 3D version.
