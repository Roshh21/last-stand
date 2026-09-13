# Island Map

Defined once in `shared/src/map/islandMap.ts` (`ISLAND_MAP`) and imported by
both client and server, so there is exactly one definition of what zones
exist and how they connect.

## Why a graph, not free 2D space

The roadmap calls for V1 movement to be zone-to-zone rather than continuous
movement (P10: "Default V1 movement to zone-to-zone travel rather than free
2D movement"). A graph is the right model for that:

- **Validation is trivial and unambiguous.** "Is this move legal?" is just
  "is there an edge from A to B?" - no collision detection, no coordinate
  math, nothing that can drift out of sync between client and server.
- **It matches the social-deduction genre.** Players need to reason about
  who could plausibly have been where - a small number of named locations
  supports that; a large continuous map doesn't add anything the game needs
  yet, and would make later systems (tasks per zone, sabotage per zone,
  accusations referencing zones) harder to reason about, not easier.
- **It's the same pattern the rest of the codebase already uses** for
  shared, server-authoritative config (see the task/ability config
  mentioned later in the roadmap) - one shared definition, validated the
  same way on both sides.

## The zones

Six zones, laid out as:

```
        Forest ────────── Power Station
          │  \                  │  \
          │   \                 │   \
        Camp ── Abandoned House  (edge: Forest–Abandoned House,
          │  \                        Power Station–Abandoned House)
          │   \
        Beach ── Dock ─────── Power Station
```

(See `client/src/components/IslandMapSvg.tsx` for the actual rendered
layout - the diagram above is just to convey connectivity, not exact
positions.)

| Zone             | Connects to                              | Notes                          |
|------------------|-------------------------------------------|--------------------------------|
| Camp             | Forest, Beach, Dock                      | Start zone - every match begins here. Unlimited capacity. |
| Forest           | Camp, Abandoned House, Power Station     | |
| Beach            | Camp, Dock                                | |
| Dock             | Camp, Beach, Power Station                | |
| Power Station    | Forest, Dock, Abandoned House             | Highest task-slot count (2) - it's the roadmap's own example task location. |
| Abandoned House  | Forest, Power Station                     | |

Camp, Forest, Power Station, and Abandoned House are the zones the roadmap
names explicitly; Beach and Dock were added so the graph has more than one
path between any two points (a strictly linear or star-shaped map would make
"who could have been near whom" reasoning too easy or too hard). Connections
are mutual in both directions - `validateMapGraph()` (used in
`shared/tests/islandMap.test.ts`) checks this can never silently drift.

## Per-zone metadata

Each zone carries fields beyond its name and connections:

- **`capacity`** - a soft cap on simultaneous occupants, or `null` for
  unlimited (Camp only). Stored now, **not enforced yet** - it's reserved
  for a future crowding/balance pass once real playtesting data exists.
- **`taskSlots`** - how many task interaction points this zone will host.
  Stored now, unused until Stage D (P20+) actually implements tasks.
- **`hazardFlag`** - whether this zone can currently host an environmental
  hazard. Always `false` today; Stage G (P35+) is what would ever set it.
- **`isStartZone`** - exactly one zone (Camp) sets this; `Match` places
  every player there when a game begins.

Defining these fields now means the zone data's *shape* won't need to change
when later stages need them - but nothing in P10-P14 reads `capacity`,
`taskSlots`, or `hazardFlag` for any actual game-logic decision yet. Only
adjacency (`connections`) and `isStartZone` are load-bearing today.

## Dynamic zone state (added in P17/P18)

The fields above are all *static* - the same for every match. Stage C added
one *dynamic*, per-match field that lives on `Match`, not on the shared map
definition: whether a zone is currently `blocked`. It starts `false` for
every zone and can be toggled by certain elemental abilities (see
`docs/elements-and-abilities.md`); `checkMove` rejects movement into a
blocked zone. This is intentionally kept separate from `hazardFlag` above -
`hazardFlag` is reserved for Stage G's environmental hazard system, which
may end up using a different mechanism entirely once it exists.
