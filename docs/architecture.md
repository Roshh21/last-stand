# Architecture

This describes the codebase as it exists after Foundation (P1-P3) and
Stages A-F (P4-P34), plus a subsequent visual overhaul: a real 3D island
scene and Island's real 5-player minimum. It covers what's actually built -
not where the roadmap is headed. See `Last-Stand-Development-Roadmap.pdf`
for the full plan.

## Monorepo layout

```
/client   - React + TypeScript + Vite. Everything the player's browser runs.
/server   - Node + TypeScript. The authoritative game server.
/shared   - Types, constants, and pure game-logic data (e.g. the island map,
            elements, abilities, tasks, teams) imported by both client and
            server, so they can never disagree about a message shape or the
            shape of the world.
/games    - Reserved for Stage J/K (Color Code, Hidden Objective). Empty
            until those stages exist - see PART 2 of the roadmap.
/docs     - This file, plus topic-specific docs:
              island-map.md            - Stage B's zone graph
              elements-and-abilities.md - Stage C
              task-system.md            - Stage D
              chat-system.md            - Stage E
              teams-and-roles.md        - Stage F (teams, roles, the key)
              security-audit.md         - P34's explicit hidden-info audit
              game-world-3d.md          - the React Three Fiber 3D scene
```

`pnpm-workspace.yaml` wires these together as workspace packages; `pnpm dev`
runs client and server concurrently. There is no root-level `/tests`
directory - `shared` and `server` each keep their own `tests/` folder
alongside the code they test, which scales better than one shared folder as
more packages gain their own test suites.

## Client / server / shared split

- **shared** has zero runtime dependencies and no I/O. It only exports types,
  constants, and pure functions (e.g. `isZoneAdjacent`, `canStartRoom`,
  `sanitizeNickname`). Both client and server import it as
  `@last-stand/shared`. If a rule needs to be checked identically on both
  sides (nickname validity, movement adjacency, ready-to-start logic), it
  lives here once rather than being re-implemented twice.
- **server** is the only source of truth for anything that matters: room
  membership, ready state, roles (later), positions, cooldowns. The client
  never asserts its own authoritative state - it sends *requests*
  (`room:join`, `match:move`, ...) and renders whatever the server broadcasts
  back.
- **client** is a thin renderer over server-pushed state, plus a small
  amount of local-only UI state (which screen is open, in-progress form
  input). It never computes gameplay outcomes itself.

## The WebSocket message envelope

Every message, in both directions, is:

```ts
interface MessageEnvelope<TPayload = unknown> {
  type: MessageType;   // e.g. "room:join", "match:snapshot"
  payload: TPayload;
  timestamp: number;
}
```

This shape is unchanged since P3. What's grown since then:

- `shared/src/messages/types.ts` - the full `MessageType` string union. Every
  message kind the protocol supports is listed here, and nowhere else should
  a message-type string be hand-typed.
- `shared/src/messages/payloads.ts` - `MessagePayloadMap`, mapping each
  `MessageType` to its concrete payload interface, plus a `TypedMessage<T>`
  helper for call sites that want the compiler to check a specific message's
  shape.

On the wire, connections are plain JSON over `ws`. A connection has no
session until it sends `session:hello`; everything else is routed through
`server/src/routing/messageRouter.ts` to a per-message-type handler in
`server/src/routing/handlers/`.

## Session model (P7)

A **session** (`playerId` + `sessionToken`) is independent of any single
socket. `SessionManager` (`server/src/session/`) owns this:

1. First message on a new socket must be `session:hello`. With a valid
   `sessionToken`, the existing session is resumed (`outcome: "resumed"`)
   and re-attached to the new socket - a page refresh reconnects the same
   player rather than creating a new one. With no valid token, a `nickname`
   is required to create a fresh session (`outcome: "created"`).
2. On disconnect, a session isn't deleted immediately: it's marked
   `connected: false` and a `DISCONNECT_TIMEOUT_MS` grace period starts. A
   reconnect within that window clears the timer and restores state. If the
   window elapses, the session is expired (`SessionManager` emits
   `"expired"`), which `RoomManager` reacts to by removing that player from
   any open room. A match never removes a permanently-disconnected player -
   there's no "leave mid-match" concept yet.
3. On resume, the server proactively resends whatever the player was last
   looking at (`server/src/routing/rehydrate.ts`) - the current room state
   and chat history, or the latest match snapshot - so the client doesn't
   have to wait for the next natural broadcast.

The client mirrors this with `localStorage` (`client/src/net/storage.ts`):
`sessionToken` and `nickname` are stored there and replayed on every
`session:hello`, including the very first connection of a session.

## Room / lobby model (P5, P6)

`Room` (data) and `RoomManager` (rules) live in `server/src/rooms/`. A Room
is deliberately *not* the same object as a Match (below) - it's "people
waiting to play," with its own status (`open` -> `starting` -> `in_game`).
`RoomManager` never trusts a client-sent value for anything authoritative
(ready flags, host status, membership); every mutation is derived from the
session making the request.

Lobby chat (`room:chat:send` / `room:chat:message` / `room:chat:history`) is
intentionally minimal - no moderation, no rate limiting, capped history.
Stage E (P25-P28) replaces this with the real communication system.

## Match / game loop (P8)

`Match` (`server/src/match/Match.ts`) is the authoritative, tick-driven
state machine a Room starts. Its status machine is
`starting -> in_progress -> ended`; `ended` is currently only reached if
every player in the match disconnects (real win conditions are Stage I,
much later in the roadmap). `MatchManager` creates a `Match` from a Room's
player list, wires its tick output to per-player broadcasts, and routes
`match:move` requests to the right match.

The tick loop runs every `MATCH_TICK_INTERVAL_MS` (150ms) and broadcasts a
full `MatchSnapshotDTO` to every player in the match on every tick. This is
simple and correct at the player counts this phase is built and tested for;
diffing/delta-compression is a reasonable future optimization once Island's
real player counts (20-50) are being tested against, but doing it now would
be optimizing before there's a measured need.

## World & movement (P10-P14)

The island is a **graph of zones**, not free 2D space - see
`docs/island-map.md` for the map itself and why. `Match` places every player
in the start zone, and `match:move` requests are validated against that
graph (`server/src/match/movement.ts`, unit-tested in isolation from any
socket/match machinery). A successful move updates the authoritative zone
immediately and starts a cooldown (`MOVEMENT_COOLDOWN_MS`); the `movement`
field on a player's snapshot record is purely a hint for the client to
animate a transition, not a distinct server-side state. As of P17/P18, a
zone can also be dynamically blocked by an ability - `checkMove` was
extended to reject into a blocked zone rather than gaining a parallel check
elsewhere.

## The 3D island scene

The flat SVG node-graph map (originally P11) has been replaced by a real
3D scene built with React Three Fiber - full design notes in
`docs/game-world-3d.md`, including why Unity wasn't an option in this
environment, how each element got a visually distinct character, and how
this was actually verified (headless Chromium screenshots of a live
5-player match, not just a successful build). The underlying game logic is
completely unchanged: the 3D scene visualizes the exact same
`match:snapshot`/`ability:used` data the old 2D map did, just placed in 3D
space and given real environments instead of colored circles.

## Island's real minimum: 5 players, one team

`MIN_ROOM_PLAYERS` is 5 (`shared/src/constants.ts`), enforced through the
existing `canStartRoom` ready-check - no new logic was needed. Five is also
exactly enough to form **one** team under the existing team-size math
(`calculateTeamCount(5) === 1`), so a minimum game is: one room, one team,
five players, one of them secretly a traitor. See
`docs/teams-and-roles.md` for the full reasoning.

## Elements & abilities (P15-P19)

Full design notes live in `docs/elements-and-abilities.md`. In short: every
player gets one of six elements (`shared/src/elements.ts`), balanced across
the match (there are no teams yet to balance across individually); their
avatar color now reflects it. Each element has exactly one ability
(`shared/src/abilities.ts`) that targets either a zone (toggling it between
open and blocked - the same action is helpful or disruptive purely
depending on the zone's state when it's used, never a separate branch an
observer could tell apart) or a task (see below). The doc also explains how
P22's "traitor's help produces a different outcome" requirement is
implemented as a tested-but-never-triggered hook, since traitor assignment
itself doesn't exist until Stage F.

## Tasks & the team objective (P20-P24)

Full design notes live in `docs/task-system.md`, including the explicit
"can progress be lost or duplicated" checklist P24 calls for. In short:
tasks are static shared config (`shared/src/tasks.ts`) instantiated as
per-match runtime state on `Match`, included in every snapshot
(`tasks`/`objective` fields on `MatchSnapshotDTO`). Progress advances
through the same ability pipeline as zone effects; one task
("Activate the Circuit") requires two players with two different elements
*currently* in the zone at once, not merely having contributed at some
point, which is what makes it genuinely un-soloable.

## The public/private split (P29-P34)

Every system before this stage broadcast one identical view of a match to
everyone. Starting with Stage F, `Match` produces two views:

- `getSnapshot()` - still identical for everyone. Gained `teamId` per
  player and a `teams` list this stage (team membership is public).
- `getPrivateStateFor(playerId)` - new, computed per player, sent only to
  that player, every tick alongside the public snapshot. Contains role,
  key status, and open private-thread summaries.

Full design notes: `docs/teams-and-roles.md` (teams, hidden roles, the key,
traitor coordination) and `docs/chat-system.md` (global/team/private/
traitor chat). The hidden-information guarantees both of these depend on
are checked, item by item, in `docs/security-audit.md` - required reading
before touching anything that adds a new kind of secret.

## Testing

No new test framework was introduced. Both `shared` and `server` run tests
with Node's built-in test runner, loaded through `tsx` so imports resolve
the same way they do under `tsx watch` in dev
(`node --import tsx --test "tests/**/*.test.ts"`). This was a deliberate
choice over Node's native `--experimental-strip-types`: this codebase's
`NodeNext` module resolution imports `./foo.js` specifiers that point at
`./foo.ts` source files, and Node's native stripping (unlike `tsx`) doesn't
resolve that pattern - only `tsx`'s loader does. Separately, TypeScript
parameter properties (`constructor(private readonly x: Foo)`) turned out to
not be supported even by `tsx`'s underlying stripping in strict-erasure
mode, so every class in this codebase uses an explicit field + constructor
assignment instead.

- `shared/tests/` - pure logic (the island map graph, adjacency and
  validation helpers, element/ability/task config validation, the
  profanity mask, team color helpers).
- `server/tests/unit/` - pure functions and single classes in isolation
  (movement validation including zone-blocking, `RoomManager` behavior,
  the bug-report and player-report handlers, element/team/role assignment
  fairness, key assignment, the rate limiter, the task-contribution and
  cooperative-check resolvers) using a fake in-memory `Session`/socket
  rather than a real connection.
- `server/tests/integration/` - a real server on an ephemeral port, driven
  by real `ws` client connections. Four suites: the original Stage A/B flow
  (create-room -> join -> ready -> start -> move -> reconnect), a 6-player
  Stage C/D flow (elements, zone-blocking, the cooperative task), a
  12-player Stage E/F flow that's effectively P34's automated security
  audit (teams, roles, the key, every chat channel, all checked for
  scoping leaks by scanning each client's *entire* raw message log rather
  than only the messages a test explicitly expected), and a focused P33
  signal/traitor-channel test.

## Deliberately not built yet

Per the roadmap, none of the following exist yet, even as stubs beyond what
P4-P34 explicitly called for: multiple abilities per player, per-team
tasks/objectives, environmental hazards beyond ability-caused zone
blocking, delayed task failure from instability, elimination, accusation/
voting, or any win-condition/results logic. Adding speculative scaffolding
for these now would guess at designs the later stages haven't made yet. The
one deliberate exception - documented in detail in
`docs/elements-and-abilities.md` - is the P22 sabotage-lever *mechanism*,
which the roadmap itself says should be "quietly live" before Stage F
exists to trigger it; Stage F's own role assignment still never calls into
it, since wiring the two together isn't something either stage's DoD asks
for.

## Changelog

- **P1-P3**: monorepo, WebSocket handshake, ping/pong.
- **P4-P9 (Stage A)**: app shell/routing, rooms, real-time lobby, sessions,
  the match tick-loop skeleton, settings + bug reporting. The original P3
  echo-test client (`client/src/services/websocket.ts`) was replaced by
  `client/src/net/GameClient.ts`, a typed client that owns session/room/match
  state and exposes it to React - the P3 scaffold had no way to route more
  than one message type and needed to grow up into this regardless.
- **P10-P14 (Stage B)**: the island zone graph, its SVG rendering, avatars,
  and server-validated zone-to-zone movement with real-time sync.
- **P15-P19 (Stage C)**: elemental identity (six elements, balanced
  assignment), the generic one-ability-per-element targeting model, and the
  zone-blocking mechanic abilities use to be genuinely dual-use. Avatar
  color changed from an arbitrary per-player hash to the player's element's
  color. Movement's `checkMove` gained a `targetZoneBlocked` check.
- **P20-P24 (Stage D)**: task data model and placement, task interaction UI,
  ability-gated task completion (including the tested-but-dormant P22
  sabotage lever), a genuinely un-soloable cooperative task, and a team
  objective meter. `MatchSnapshotDTO` gained `zones`, `tasks`, and
  `objective` fields.
- **P25-P28 (Stage E)**: global, team, and limited private chat, all
  through one `MatchChat` service with shared rate limiting and profanity
  masking; mute (client-only) and report (persisted, mirrors
  `BugReportStore`). New `match:chat:*` / `privateChat:*` message family,
  distinct from Stage A's `room:chat:*` lobby placeholder.
- **P29-P34 (Stage F)**: teams, hidden traitor roles, the secret key and
  its private-chat-gated transfer, opt-in traitor-pair signaling and a
  traitor-only channel, and the security audit verifying none of it leaks.
  `Match` now produces two views (`getSnapshot()` public,
  `getPrivateStateFor()` private) instead of one - the architectural
  change this stage's guarantees all rest on.
- **3D world + 5-player minimum**: replaced the flat SVG map with a real
  React Three Fiber 3D scene (distinct environments per zone, six visually
  distinct elemental characters, ability effects, a movable camera - see
  `docs/game-world-3d.md`), lazy-loaded so it doesn't cost anything on
  screens that don't need it. Separately, `MIN_ROOM_PLAYERS` was raised
  from the dev-testing value of 2 to Island's real minimum of 5, which
  also happens to be exactly enough to form one team under the existing
  team-size math - no new logic needed, just the constant and the tests/
  docs that assumed the old value.
