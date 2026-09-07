# Last Stand

An original **real-time multiplayer social-strategy game** where players work together to survive and complete objectives while hidden traitors secretly work against them.

> **"Everyone may need each other, but ultimately only one person wins."**

## Current Status

**v0.3 — Multiplayer 3D Prototype**

Last Stand is a browser-based multiplayer game built around a **server-authoritative real-time architecture**.

The current prototype includes:

* Real-time multiplayer communication
* WebSocket-based client-server synchronization
* Room creation and room-code based joining
* Multiplayer lobbies
* Persistent player sessions and reconnection
* Authoritative server-side game state
* Real-time player presence
* Interactive 3D world built with Three.js
* Server-validated player actions
* Shared multiplayer world state
* Reusable multiplayer infrastructure for future game modes

The project is designed as a reusable multiplayer platform rather than a single tightly coupled game implementation.

## Architecture

Last Stand follows a **server-authoritative architecture**.

Clients submit player actions to the server rather than directly controlling shared game state.

```text
Browser Client
     │
     │ WebSocket
     ▼
Node.js Game Server
     │
     ├── Game State
     ├── Validation
     ├── Matchmaking
     ├── Rooms & Lobbies
     └── Session Management
     │
     ▼
Redis / PostgreSQL
```

The core gameplay pipeline follows:

```text
Player Input
     ↓
Server Validation
     ↓
State Transition
     ↓
State Synchronization
     ↓
Connected Players
```

This keeps game rules authoritative on the server and prevents client-side behavior from becoming the source of truth.

## Multiplayer Infrastructure

The platform provides reusable services for multiplayer experiences, including:

* Matchmaking
* Private rooms
* Room codes
* Lobbies
* Player presence
* Persistent sessions
* Reconnection
* Match lifecycle management
* Real-time state synchronization

Redis is used for ephemeral multiplayer state, matchmaking, presence, caching, and pub/sub, while PostgreSQL handles persistent data such as player accounts, match history, progression, and telemetry.

WebSocket communication uses **versioned, schema-first contracts** to keep client and server state synchronized predictably.

## Island

**Island** is the first multiplayer social-strategy experience built on the Last Stand platform.

Players must cooperate to complete objectives while dealing with incomplete information and hidden agendas.

The game features:

* Hidden roles
* Cooperative objectives
* Fragmented information
* Real-time communication
* Constrained voting
* Tournament progression
* AI-controlled opponents

The central tension comes from cooperation versus betrayal:

> Work together to survive.
> Figure out who you can trust.
> Make sure you're the one left standing.

## Tech Stack

**Client**

* React
* TypeScript
* Three.js

**Server**

* Node.js
* TypeScript
* WebSockets

**Infrastructure**

* Redis
* PostgreSQL

## Quick Start

Requires **Node.js (LTS)** and **pnpm**.

```bash
pnpm install
pnpm dev
```

This starts the client and server together.

**Client:** `http://localhost:5173`
**Server:** `ws://localhost:3000`

Open the client in multiple browser tabs to test the multiplayer flow:

1. Create a room in one tab.
2. Copy the generated room code.
3. Join the room from another tab.
4. Enter the shared world.
5. Interact with the multiplayer environment and observe synchronized player state.

## Useful Commands

```bash
pnpm typecheck   # Type-check every package
pnpm test        # Run shared + server test suites
pnpm build       # Production build of client and server
```

## Project Structure

```text
/client    React + TypeScript + Three.js browser client
/server    Node.js + TypeScript multiplayer server
/shared    Shared types, constants, schemas, and game logic
/games     Standalone game implementations
/docs      Architecture and design notes
```

## Design Philosophy

Last Stand is built around a reusable:

```text
Input
  ↓
Validation
  ↓
State Transition
  ↓
Synchronization
```

pipeline.

Game mechanics should be able to evolve without tightly coupling gameplay rules to client behavior.

This allows additional multiplayer experiences to be built on the same underlying infrastructure rather than recreating rooms, sessions, matchmaking, presence, and synchronization for every game.

## Roadmap

The current prototype focuses on validating the multiplayer foundation and the core social-strategy concept.

Future development may include:

* Expanded Island gameplay
* More multiplayer game modes
* Improved AI opponents
* Progression systems
* Tournament systems
* More advanced social mechanics
* Expanded 3D environments
* Production multiplayer infrastructure

Last Stand is an evolving multiplayer project focused on exploring **real-time systems, multiplayer architecture, and social strategy gameplay**.
