# Architecture

This document describes the architecture of the Last Stand 2D multiplayer prototype.

## Monorepo Layout

```text
/client   - React + TypeScript + Vite browser application
/server   - Node + TypeScript authoritative multiplayer server
/shared   - Shared types, constants, map data, and pure game logic
/games    - Reserved for standalone game modules
/docs     - Architecture and game design documentation
```

`pnpm-workspace.yaml` connects the packages as a pnpm workspace. The root development command runs the client and server concurrently.

## Client / Server / Shared

### Shared

`/shared` contains code that must be understood consistently by both sides of the application.

It contains:

- Message types
- Message payload definitions
- Constants
- Island/map data
- Pure validation and game-logic functions

The shared package does not perform I/O or maintain network state.

Examples of shared validation include:

- Nickname validation
- Room-start requirements
- Zone adjacency
- Island map validation

Keeping these definitions in one package prevents the client and server from using different representations of the same protocol or world.

### Server

`/server` is the authoritative multiplayer layer.

It owns:

- WebSocket connections
- Player sessions
- Room membership
- Host state
- Ready state
- Lobby state
- Match state
- Player positions
- Movement validation
- Server tick loop
- State broadcasts

The server does not trust client-provided authoritative values. Clients send requests, and the server decides whether those requests are valid.

### Client

`/client` is responsible for:

- Rendering the application
- Rendering the island world
- Rendering players
- Lobby and room UI
- Chat UI
- Settings and forms
- Local UI state
- Sending requests to the server
- Rendering server-provided multiplayer state

The client does not decide authoritative gameplay outcomes.

## WebSocket Protocol

All client-server communication uses WebSockets.

Messages use a common envelope:

```ts
interface MessageEnvelope<TPayload = unknown> {
  type: MessageType;
  payload: TPayload;
  timestamp: number;
}
```

The complete message type union is defined in:

```text
shared/src/messages/types.ts
```

Payload definitions are maintained in:

```text
shared/src/messages/payloads.ts
```

This gives the client and server a common protocol contract.

A new connection begins with a session handshake. After the session is established, messages are routed by their message type to the corresponding server handler.

## Session Model

A session is independent of an individual WebSocket connection.

A session contains:

```text
playerId
sessionToken
nickname
connection state
room/match state
```

### Connecting

A new socket begins with a `session:hello` message.

If the supplied session token is valid, the server resumes the existing session.

If there is no valid session token, the client supplies a nickname and the server creates a new session.

### Disconnecting

A disconnected session is not immediately destroyed.

The server marks the session as disconnected and starts a grace period. If the player reconnects during that period, the existing session is attached to the new socket.

If the grace period expires, the session is removed according to the current room and match rules.

### Rehydration

When a session reconnects, the server sends the state needed to restore the player's current view, such as:

- Current room state
- Lobby chat history
- Current match snapshot

The client can therefore restore its state without waiting for another gameplay event.

## Room and Lobby Model

Rooms represent players waiting to start a game.

A room contains information such as:

```text
roomId
host
players
ready states
status
chat history
```

The room lifecycle is:

```text
open
  ↓
starting
  ↓
in_game
```

Room management is handled by:

```text
server/src/rooms/
```

`RoomManager` derives authoritative changes from the session making the request rather than trusting client-supplied player identities.

## Match Model

A match represents the active game created from a room.

The authoritative match state is maintained by:

```text
server/src/match/Match.ts
```

The current match state machine is:

```text
starting
    ↓
in_progress
    ↓
ended
```

The match runs on a server-side tick loop. At each tick, the server produces a match snapshot and broadcasts the current state to connected players.

The current prototype uses full snapshots rather than delta compression, keeping synchronization simple and predictable.

## Movement

Movement is represented as zone-to-zone travel.

A client sends a movement request containing the desired destination. The server checks whether the destination is connected to the player's current zone.

```text
Current Zone
     │
     │ move request
     ▼
Server validation
     │
     ├── invalid → reject
     │
     └── valid → update position
                      │
                      ▼
                 broadcast state
```

The authoritative player position is updated only after successful validation.

Movement logic is separated from WebSocket handling so it can be tested independently.

## State Synchronization

The server periodically broadcasts the authoritative match state.

```text
Client A ── move request ──► Server
                              │
                              ▼
                       Validate movement
                              │
                              ▼
                       Update match state
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
             Client A                  Client B
          updated snapshot          updated snapshot
```

All connected clients therefore render the server's authoritative world state.

## Island Data

The island is defined once in:

```text
shared/src/map/islandMap.ts
```

Both client and server import this definition.

The map contains:

- Zone names
- Connections
- Capacity metadata
- Task-slot metadata
- Hazard metadata
- Start-zone information

See [`island-map.md`](island-map.md) for the complete island definition.

## Testing

Tests are kept close to the packages they validate.

```text
/shared/tests
/server/tests/unit
/server/tests/integration
```

### Shared Tests

Validate pure logic such as:

- Map connectivity
- Zone adjacency
- Shared validation helpers

### Server Unit Tests

Test isolated server components such as:

- Movement validation
- Room management
- Message handlers
- Session behavior

### Integration Tests

Use real WebSocket connections against a server running on an ephemeral port.

The integration flow covers:

```text
Create room
→ Join room
→ Ready
→ Start
→ Move
→ Reconnect
```

This verifies that the major pieces work together rather than only testing individual functions.
