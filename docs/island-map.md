# Island Map

The Last Stand 2D prototype represents its island as a connected graph of named zones.

The map is defined once in:

```text
shared/src/map/islandMap.ts
```

Both the client and server import the same definition, so the rendered world and server-side movement rules use the same zone structure.

## Why a Zone Graph?

The prototype uses zone-to-zone movement instead of unrestricted 2D coordinate movement.

This provides a simple and deterministic movement model:

- A move is legal when the destination is connected to the current zone.
- The server can validate movement without collision calculations.
- The client and server share exactly the same map definition.
- Named locations make player positions easy to understand.
- The world can be rendered visually while keeping movement rules simple.

The graph is used for connectivity and movement validation. The browser renders the zones as a visual island map.

## Zones

The current island contains six zones:

```text
        Forest ───────── Power Station
          │  \                 │  \
          │   \                │   \
        Camp ── Abandoned House
          │  \
          │   \
        Beach ── Dock ─────── Power Station
```

The diagram shows connectivity rather than exact visual positions.

## Connectivity

| Zone | Connected Zones | Notes |
|---|---|---|
| Camp | Forest, Beach, Dock | Starting zone for every match |
| Forest | Camp, Abandoned House, Power Station | Central route through the island |
| Beach | Camp, Dock | Coastal route |
| Dock | Camp, Beach, Power Station | Connects the coastal and station areas |
| Power Station | Forest, Dock, Abandoned House | Connects multiple paths |
| Abandoned House | Forest, Power Station | Upper-island connection |

Connections are bidirectional.

For example:

```text
Camp → Forest
```

also means:

```text
Forest → Camp
```

The shared map validation tests ensure that the graph does not contain accidental one-way connections.

## Starting Position

**Camp** is the start zone.

When a match begins, players are initially placed in Camp.

The start zone is identified through the map data rather than being hard-coded separately into the match logic.

## Zone Metadata

Each zone can contain metadata describing the world.

### `capacity`

The intended occupancy capacity of a zone.

`null` represents unlimited capacity.

The current prototype stores this information but does not use it to reject movement.

### `taskSlots`

The number of task interaction points associated with a zone.

This value is part of the zone definition.

### `hazardFlag`

Indicates whether a zone can host an environmental hazard.

The current prototype does not activate environmental hazards.

### `isStartZone`

Identifies the starting zone.

Exactly one zone, Camp, is marked as the start zone.

## Movement Validation

A movement request is validated against the graph:

```text
Player currently in Camp
          │
          │ request: move → Forest
          ▼
       Server
          │
          ├── Forest connected to Camp? YES
          │
          ▼
   Update player zone
          │
          ▼
 Broadcast updated state
```

An invalid move is rejected:

```text
Player currently in Camp
          │
          │ request: move → Power Station
          ▼
       Server
          │
          ├── Power Station connected to Camp? NO
          │
          ▼
        Reject
```

This keeps movement authoritative on the server while allowing the client to display the same world structure.

## Rendering

The visual layout is rendered by:

```text
client/src/components/IslandMapSvg.tsx
```

The SVG layout controls how the island looks on screen, while `ISLAND_MAP` controls the logical connectivity.

Keeping these concerns separate means the visual arrangement can change without changing the underlying movement rules.
