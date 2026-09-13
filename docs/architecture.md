# Architecture

This document describes the current Last Stand codebase: its package layout,
authoritative server model, shared protocol, game systems, 3D client, testing
strategy, and current implementation boundaries.

## Monorepo layout

```text
/client   - React + TypeScript + Vite. Everything the player's browser runs.
/server   - Node + TypeScript. The authoritative game server.
/shared   - Types, constants, and pure game-logic data imported by both client
            and server so they cannot disagree about message shapes or world data.
/games    - Reserved for standalone games.
/docs     - Architecture and system documentation.
```

`pnpm-workspace.yaml` wires the packages together; `pnpm dev` runs client and
server concurrently. There is no root-level `/tests` directory: `shared` and
`server` each keep their own tests beside the code they cover.

## Client / server / shared split

- **shared** has zero runtime dependencies and no I/O. It exports types,
  constants, validation helpers, and shared game data such as the island map,
  elements, abilities, tasks, and teams. Rules that must agree on both sides
  live here once rather than being re-implemented twice.
- **server** is the source of truth for authoritative state: room membership,
  ready state, teams, roles, positions, cooldowns, task progress, chat
  permissions, and hidden information. The client sends requests and renders
  server-provided results.
- **client** is primarily a renderer over server-pushed state, with local UI
  state for screens, forms, timers, mute settings, and other presentation
  concerns. It does not decide gameplay outcomes.

## The WebSocket message envelope

Every message, in both directions, uses:

```ts
interface MessageEnvelope<TPayload = unknown> {
  type: MessageType;
  payload: TPayload;
  timestamp: number;
}
```

`shared/src/messages/types.ts` contains the complete `MessageType` union.
`shared/src/messages/payloads.ts` maps each message type to its payload
interface and provides typed helpers for call sites.

Connections use plain JSON over `ws`. A connection has no active session until
it sends `session:hello`; subsequent messages are routed through
`server/src/routing/messageRouter.ts` to their handlers.

## Session model

A **session** (`playerId` + `sessionToken`) is independent of a single socket.
`SessionManager` (`server/src/session/`) owns session lifecycle:

1. A new socket must begin with `session:hello`. A valid token resumes the
   existing session; otherwise a nickname is required to create one.
2. A disconnect marks the session as disconnected and starts the configured
   grace period. Reconnection within that window restores the session.
3. When a session expires, `RoomManager` removes it from open rooms. A player
   already inside a match remains part of that match; there is no mid-match
   leave operation.
4. On resume, the server re-sends the player's current room state and chat
   history, or the latest match state, so the client can immediately restore
   its view.

The client stores `sessionToken` and `nickname` in `localStorage` and replays
them on `session:hello`.

## Room / lobby model

`Room` and `RoomManager` live in `server/src/rooms/`. A Room represents players
waiting to play and has its own lifecycle (`open` -> `starting` -> `in_game`).
The server derives membership, host status, and ready state from the active
session rather than trusting client-supplied authoritative values.

Lobby chat (`room:chat:send`, `room:chat:message`, `room:chat:history`) is
intentionally minimal: it has capped history and is scoped to the pre-game
room. Match communication is handled separately by `MatchChat`.

## Match / game loop

`Match` (`server/src/match/Match.ts`) is the authoritative tick-driven state
machine created from a Room's player list. Its status machine is
`starting -> in_progress -> ended`. A match currently reaches `ended` when all
players have disconnected.

`MatchManager` creates matches, wires tick output to per-player broadcasts,
and routes match requests to the correct match. The tick loop runs every
`MATCH_TICK_INTERVAL_MS` (150ms) and broadcasts a full `MatchSnapshotDTO`.
This keeps the state model straightforward and gives the client a complete
view of the current match on every tick.

## World & movement

The island is a **graph of zones**, not free 2D space. `Match` places every
player in the start zone, and `match:move` requests are validated against
`server/src/match/movement.ts` using the shared map.

A successful move updates the authoritative zone and starts
`MOVEMENT_COOLDOWN_MS`. The `movement` field in the snapshot is a client-facing
animation hint containing the source zone, destination zone, start time, and
duration. A zone can also be dynamically blocked by an ability, and movement
into a blocked zone is rejected.

## The 3D island scene

The client uses React Three Fiber for the playable island scene. The scene
visualizes the same `match:snapshot` and `ability:used` state used by the game
server rather than maintaining a second gameplay model.

The 3D scene contains distinct environments for the six zones, procedural
elemental characters, ability effects, camera controls, and movement
interpolation. It is lazy-loaded by `IslandMatch.tsx`, so screens that do not
start a match do not pay the 3D bundle cost.

See `docs/game-world-3d.md` for the scene design and implementation details.

## Elements & abilities

Every player receives one of six elements: Fire, Water, Nature, Lightning,
Earth, or Wind. Element assignment is balanced across the match.

Each element has one ability. Abilities use a generic `ability:use` message
and are resolved authoritatively by the server. Zone-targeting abilities
toggle a zone between open and blocked; Lightning targets tasks instead.
Cooldowns are tracked server-side through `abilityReadyAt`.

Successful ability use is broadcast as an anonymized `ability:used` event
containing the element and zone rather than the acting player's identity.
Rejections are returned only to the requesting player with a reason code.

## Tasks & shared objective

Tasks are defined in `shared/src/tasks.ts` and instantiated as per-match
runtime state. Task progress and completion are part of `MatchSnapshotDTO`.

Task contributions use the same authoritative ability pipeline as other
gameplay actions. The cooperative task requires the configured number of
distinct elements to be present together in the relevant zone, so progress
cannot be completed by a single player acting alone.

Task runtime state also keeps server-only contribution history and
instability data. These fields are deliberately absent from the public task
DTO.

## Teams, roles, key, and private state

The minimum room size is `MIN_ROOM_PLAYERS = 5`. Team assignment targets the
configured team size while respecting the minimum team size. Each team gets
one traitor, and roles are kept in private server state.

`Match` produces two views:

- `getSnapshot()` is public and safe to broadcast to every player. Team
  membership is included here.
- `getPrivateStateFor(playerId)` is computed for one player and contains that
  player's role, key status/content, private-chat information, and other
  personal hidden state.

The key has a single server-side holder. It can be transferred only inside an
active private chat, is never duplicated, and cannot be transferred to a
disconnected target.

Traitor coordination is opt-in: both participants signal within a private
thread before a traitor-only channel can unlock. The unlock state is private
to the participants.

See `docs/teams-and-roles.md` for the complete behavior and
`docs/security-audit.md` for the hidden-information guarantees.

## Chat system

`MatchChat` owns four match channels: global, team, private, and traitor.

- Global messages are broadcast to the whole match.
- Team messages are sent only to members of the sender's team.
- Private messages are sent directly to the two participants.
- Traitor messages are available only to an unlocked traitor pair.

All match channels share rate limiting, profanity masking, and capped history.
Private and team delivery is constructed server-side from authoritative
membership rather than client-supplied recipient lists.

Mute is client-side. Reports are persisted by `PlayerReportStore`.

## Testing

`shared` and `server` use Node's built-in test runner through `tsx`:

```text
node --import tsx --test "tests/**/*.test.ts"
```

The test suite includes:

- `shared/tests/` for map validation, element/ability/task configuration,
  moderation helpers, and team helpers.
- `server/tests/unit/` for movement, rooms, reports, assignment logic, key
  handling, rate limiting, and task contribution behavior.
- `server/tests/integration/` for real WebSocket flows covering rooms,
  reconnects, movement, elements, tasks, chat, teams, roles, key handling,
  and hidden-information isolation.

The hidden-information integration tests inspect each client's complete raw
message log, not only messages a test explicitly expects. This makes the
security checks resilient to accidental leaks through unexpected message
paths.

## Current implementation boundaries

The current game intentionally keeps several systems simple:

- One ability is assigned to each player.
- Tasks and the shared objective are match-wide.
- Environmental hazards are not active game logic.
- There is no player elimination state.
- There is no accusation or voting system.
- There is no gameplay win-condition/results system beyond the current match
  lifecycle.
- Task instability is tracked internally but does not currently trigger a
  delayed task failure.

These boundaries reflect the code that is actually present and tested.
