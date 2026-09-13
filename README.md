# Last Stand

A multiplayer survival and social-deduction game platform: everyone on a team
needs each other to get tasks done, but one or more hidden traitors are
quietly working against them. "Everyone may need each other, but ultimately
only one person wins."

**Current status:** v0.7+ ("Trust No One"), plus a visual overhaul beyond
the roadmap's original scope. Rooms, real-time lobbies, stable sessions
across reconnects, and an authoritative game loop are live (P4-P9); the
island is a real, explorable **3D scene** (React Three Fiber) with distinct
environments per zone (P10-P14, visually rebuilt); every player has an
elemental identity and a dual-use ability, now rendered as a visually
distinct 3D character per element (P15-P19); a real task system with a
genuinely cooperative task and a team objective meter is live (P20-P24);
global/team/private chat with basic moderation is live (P25-P28); and the
emotional core - teams, hidden traitor roles, the secret key, and opt-in
traitor coordination, all with an audited no-leak guarantee - is live
(P29-P34). Island's real minimum is **5 players** (one full team, one
traitor among them) - a room can't start with fewer. See
`Last-Stand-Development-Roadmap.pdf` for the full 67-phase plan and
`docs/architecture.md` for how the codebase is structured, including
`docs/game-world-3d.md` for the 3D scene specifically.

## Quick start

Requires Node.js (LTS) and pnpm.

```bash
pnpm install
pnpm dev
```

This runs the client (Vite, default `http://localhost:5173`) and server
(`ws://localhost:3000`) together. Open the client URL in two browser tabs to
try creating a room in one and joining with the code in the other.

Other useful commands:

```bash
pnpm typecheck   # type-check every package
pnpm test        # run shared + server test suites
pnpm build       # production build of client and server
```

## Layout

```
/client   React + TypeScript + Vite - the browser app
/server   Node + TypeScript - the authoritative game server
/shared   Types, constants, and pure game logic used by both
/games    Reserved for future standalone games (Color Code, Hidden Objective)
/docs     Architecture and design notes
```
