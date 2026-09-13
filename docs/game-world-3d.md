# The 3D Island

This replaces the flat SVG node-graph map (the original 2D map) with a
real, explorable 3D scene: a genuine island with distinct environments per
zone, and elemental characters with visually distinct bodies, materials,
and particle effects instead of colored circles.

## Why React Three Fiber instead of Unity

Unity needs its Editor - a GUI application with its own licensing and
install flow - which isn't available in this sandboxed, headless
environment. What actually runs and is genuinely playable in a browser,
with zero extra install for the player, is real WebGL rendered through
Three.js. **React Three Fiber** (`@react-three/fiber`) wraps Three.js in
React's component model, so the 3D scene is written the same way as the
rest of this client - components, props, hooks - and plugs directly into
the existing multiplayer state (`match:snapshot`, `ability:used`, etc.)
without any new server-side concepts. `@react-three/drei` supplies a
handful of well-tested helpers (`OrbitControls`, `Sky`, `Sparkles`, `Html`)
so most of the scene is built from primitives rather than hand-rolled
shader code.

No 3D model files (`.glb`/`.gltf`) are available in this environment -
there's no way to author or import them here. Every character and zone
set-piece below is built procedurally from Three.js primitive geometries
(spheres, cones, boxes, icosahedrons) and materials, which is a real and
common technique for stylized/prototype 3D games, not a placeholder for
"real" art.

## Verifying this actually works

This is the one part of the project I can't just eyeball by running the
dev server - I have no display. What made real verification possible: this
environment happens to have a pre-installed, working headless Chromium
(via Playwright) with functioning WebGL 2 (software-rendered via
SwiftShader). That let me actually load the running app in a real browser,
drive a full 5-player match (one browser tab + four bot WebSocket clients),
and take real screenshots of the rendered 3D scene - not just confirm the
code compiles.

That process caught one genuine bug worth naming: the first version drove
character-position interpolation from a `setInterval(..., 50)` updating
React state 20 times a second, which pushed enough render load through
React (on top of the WebGL render loop) that the page became sluggish
enough to make browser automation unreliable. The fix was moving position
interpolation entirely inside each character's own `useFrame` callback -
Three.js's render loop, which runs outside React's reconciliation - so a
moving player's position is computed and applied via direct Three.js
object mutation, not a React re-render. This is both the correct
performance practice for R3F and what actually made the scene smooth. The
fixed version was verified the same way, end to end, including movement,
ability effects, and zero console/page errors across a full match.

## Zone layout

`three/zoneLayout3D.ts` gives each of the six existing zones (unchanged
from `shared/src/map/islandMap.ts`) a fixed 3D ground position, laid out to
mirror the old 2D map's spatial relationships (Camp central, Forest
upper-left, Beach lower-left, Dock lower-right, Power Station upper-right,
Abandoned House right-of-center). The underlying adjacency graph - what's
actually reachable from where - is exactly the same shared data
already validated; only where things are drawn changed.

## Distinct environments per zone (`three/ZoneMarker3D.tsx`)

Each zone is a clickable ground platform plus a bespoke set-piece:

- **Camp** - a ring of log "seats" around a lit, particle-emitting
  campfire. The start zone, meant to read as "home."
- **Forest** - nine procedurally-scattered trees (trunk + two stacked
  cone tops).
- **Beach** - sandy platform, two palm trees, a few scattered rocks.
- **Dock** - a wooden plank pier on pilings, extending toward the water.
- **Power Station** - clustered tanks and a building block, with a
  flickering red warning light (this is the project's own example task
  location, and visually the most "industrial" zone since all three tasks
  live here).
- **Abandoned House** - a single tilted house with a broken plank leaning
  against it, in weathered tones.

Zone decoration positions use a small deterministic seeded PRNG
(`createSeededRandom`), not `Math.random()` - not because reproducibility
matters here (it doesn't; nothing about tree placement is gameplay-visible
or synced), but because calling `Math.random()` directly during render
trips this project's established "no impure calls during render" rule (the
same class of issue fixed earlier for `Date.now()` - see
`docs/architecture.md`'s changelog). A fixed-seed generator produces the
same scattered-looking layout every time without calling any impure API.

Reachable zones get an amber highlight ring; the player's current zone gets
a teal one; a blocked zone (the existing ability-driven mechanic)
gets a red pulsing torus. An incomplete task at a zone shows a small
rotating marker above it. Path connectors between zones
(`three/PathConnectors.tsx`) recolor from tan to dark red when either end
is blocked - directly visualizing existing server state, not new game
logic.

## Elemental characters (`three/ElementalCharacter.tsx`)

Every character shares a base "spirit" silhouette (a body sphere, a
smaller head sphere, two eye dots for personality) so they read as
characters rather than abstract shapes, then diverges per element:

| Element | What makes it distinct |
|---|---|
| Fire | Emissive orange-red, smooth sine-wave flicker, rising ember `Sparkles`, a warm point light |
| Water | Translucent blue (transparent material, not full glass transmission - see below), gentle bob |
| Nature | Matte green, flat-shaded, five flat "leaf" cones fanned around the body |
| Lightning | Emissive pale yellow, jittery random flicker (distinct from Fire's smooth pulse), five rapidly-orbiting angular shards |
| Earth | Faceted icosahedron body (not a smooth sphere - the one element with a genuinely different silhouette), four slowly-orbiting rock chunks, no particles at all (deliberately "heavier," stiller than the others) |
| Wind | Very pale, highly transparent, continuous slow rotation, a wide/fast particle trail |

**Why not `MeshTransmissionMaterial` for Water?** Drei's transmission
material looks better but needs a properly configured environment/render
pass to avoid looking wrong, and I can't iterate on that visually beyond
what the one verification pass already covered. A standard transparent
`MeshStandardMaterial` is guaranteed to render sanely with zero extra setup
- the safer choice given the verification constraints above.

Movement between zones reuses the exact `movement` field the server
already provides (`fromZoneId`/`toZoneId`/`startedAt`/`durationMs`, from the shared map) - `computeCharacterPosition()` eases between the two zones'
positions over that same window, so what you see is a direct visualization
of authoritative server state, not a separate client-side animation
system the server knows nothing about.

## Ability effects (`three/AbilityEffectBurst.tsx`)

Every `ability:used` event (anonymized to element and zone only, never a player id) spawns a short-lived expanding ring + spark burst
at that zone's position, colored by the element. This is purely a
visualization of an event the client already receives; no new server data
was needed.

## Camera

`OrbitControls` (drei) lets the player look around freely; a small
`CameraRig` component smoothly re-centers the orbit target on the player's
current zone as they move, without ever snapping instantly. Movement,
rotation limits, and zoom bounds are tuned to keep the camera from going
underground or too far out, not to lock the player into one fixed angle.

## Performance: lazy-loaded, not on the critical path

Three.js and its ecosystem add roughly 900KB (minified) to the bundle - a
real cost for a page that doesn't need it. `IslandMatch.tsx` imports the
whole 3D scene via `React.lazy()` behind a `Suspense` boundary, so Home,
Games, Settings, and even the room lobby never download it; the cost is
paid only once a match actually starts.
