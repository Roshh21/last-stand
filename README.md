# Last Stand

A browser-based multiplayer social-deduction game set on a 3D island.

## Project structure

```text
/client   - React + TypeScript + Vite client
/server   - Node + TypeScript authoritative game server
/shared   - Shared types, constants, validation, map, elements, abilities, tasks, teams
/games    - Reserved for standalone games
/docs     - Architecture and system documentation
```

## Current game systems

- Real-time multiplayer rooms and lobbies
- Session persistence across reconnects
- Server-authoritative match state and movement
- A six-zone island map with zone-to-zone movement
- A procedural 3D island rendered with React Three Fiber
- Six elemental identities and one ability per element
- Zone blocking and task-targeting abilities
- Cooperative tasks and a shared objective meter
- Global, team, private, and traitor chat
- Chat rate limiting, profanity masking, mute, and player reports
- Teams, hidden traitor roles, and a secret key
- Private key transfer and opt-in traitor coordination
- Automated tests for shared logic, server behavior, integration flows, and hidden-information boundaries

## Player count

The minimum room size is **5 players**. Team assignment and role assignment are handled by the authoritative server.

## Development

The repository uses a pnpm workspace. Client, server, and shared packages are kept separate while sharing the same TypeScript protocol and game data.

See the documentation in `docs/` for details on the architecture, island map, elements and abilities, task system, chat system, teams and roles, security boundaries, and 3D world.
