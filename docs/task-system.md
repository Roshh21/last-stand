# Task System

See `shared/src/tasks.ts` for the data model and
placement, and `server/src/match/Match.ts` for the runtime state and how
abilities connect to it (the ability side of this is covered in more depth
in `docs/elements-and-abilities.md` - this file focuses on tasks and the
team objective).

## Data model & placement

`TaskDefinition` is static, shared config - the same pattern as the island
map (`shared/src/map/islandMap.ts`): one source of truth, imported by both
client and server, so there's never a question of which side's copy is
right.

```ts
interface TaskDefinition {
  id: string;
  zoneId: string;
  name: string;
  requiredElements: ElementId[];
  completionThreshold: number;
  minContributors: number;
  requiredDistinctElements: number;
}
```

Three tasks are placed at the Power Station, matching the project's
example almost verbatim:

| Task | Requires | Cooperative? |
|---|---|---|
| Cool the Generator | Water | No |
| Ignite the Furnace | Fire | No |
| Activate the Circuit | Lightning + Earth | Yes - 2 players, 2 distinct elements |

Runtime state (`progress`, `completed`) is per-match, built fresh from this
config in `Match`'s constructor and included in every `match:snapshot`
broadcast (`TaskStateDTO`) - `progress` and `completed` are the only
runtime fields exposed; see the ability-gated completion section below for what's deliberately excluded.

`validateTaskDefinitions()` checks every task's `zoneId` against the real
map, checks thresholds and contributor counts are sane, and runs in
`shared/tests/elementsAbilitiesTasks.test.ts` - the same structural-check
pattern as the island map's `validateMapGraph()`.

## Task interaction

There's no separate "interact" message. Standing in a zone with a task is
enough to see it - `IslandMatch.tsx` filters `match.tasks` down to whatever
matches the player's current `zoneId` and renders a `TaskCard` for each:
name, an animated progress bar, which element(s) qualify (color-coded to
match each element's badge), a "you qualify" indicator if the player's own
element is one of them, and a "Done" badge once complete. A cooperative
task additionally shows its requirement ("2+ people, 2+ elements here at
once") right on the card, so the requirement is visible before anyone tries
and gets rejected.

Deliberately absent, per the design's "no action proves guilt" principle:
the button to use your ability on a task is never disabled just because
your element doesn't match. Disabling it would leak information a real
player wouldn't have (elements aren't secret here, but the *convention* of
never letting UI state signal "this won't help" is the hidden-role system depends on the private-state boundaries documented elsewhere).

## Ability-gated completion

Every ability use on a task runs through `resolveTaskContribution()` (see
`docs/elements-and-abilities.md` for the full reasoning behind its
`isSaboteur` parameter, which the active gameplay path currently sets to `false`). The
short version: right element -> real progress; wrong element -> nothing.
Progress is clamped to `completionThreshold`, and `completed` flips once
progress reaches it.

The one thing worth restating here: `TaskStateDTO` (what actually goes over
the wire) has no `instability` field and no contribution history. Those
live only on the server's internal `TaskRuntimeState`. A client - now or
even when hidden roles are involved - can never distinguish "this contribution happened to
be smaller" from "this player is flagged as something." That's the whole
point of building the lever this way.

## Cooperative tasks

`checkCooperativeRequirement()` (`server/src/match/taskContribution.ts`)
checks who is **physically present in the task's zone at this exact
instant** - not who has ever contributed. Concretely: every time a player
attempts to use their ability on a cooperative task, the server looks at
every *connected* player currently sharing that zone, collects their
elements, and checks both thresholds (`minContributors`,
`requiredDistinctElements`) are met before resolving anything.

This is a deliberate choice over tracking historical contributors:

- **It can't be soloed by spamming one ability.** A lone player retrying
  over and over never changes who's in the room with them, so the
  precondition never becomes true. Tested directly in
  `server/tests/unit/taskContribution.test.ts` and end-to-end in
  `server/tests/integration/abilitiesAndTasks.test.ts` (a player alone at
  the Power Station gets `needs_more_players` every time).
- **It can't be "banked."** There's no partial credit for having once had
  the right people present - if they leave, the next attempt re-checks from
  scratch.
- **A failed cooperative attempt costs nothing.** `useAbilityOnTask()`
  returns `needs_more_players` *before* touching the ability cooldown, so
  trying (and failing) doesn't punish a player for checking whether enough
  help has arrived yet.

Disconnected players don't count toward "present" - someone who dropped
mid-task can't be a phantom third contributor holding a slot open.

## Team objective

`ObjectiveStateDTO` is deliberately simple for V1: `requiredTasks` defaults
to *every* task (`getRequiredObjectiveTaskCount`), so "met" means the whole
task list is done. Nothing acts on `met` currently - no win condition fires, no
match ends because of it. No win condition is currently attached to it; the
job was only to make the progress visible and durable, which
`ObjectiveMeter.tsx` does as a simple "X / Y tasks" bar.

### Can task progress ever be lost or duplicated?

This checklist is kept here rather than as a comment so the state-management guarantees remain easy to verify as the code changes.

- **Lost on disconnect?** No. Task state lives on the `Match` instance
  itself, keyed by task id - never on any per-player structure. A
  disconnecting player only flips their own `connected` flag
  (`Match.setConnected`); nothing about task progress is touched.
- **Lost on reconnect?** No - and nothing extra had to be built for this.
  `sendRehydration()` (the session system) already resends the latest full
  `match:snapshot` on `session:resumed`, and tasks/objective are just
  fields on that same snapshot. Persistence "fell out" of the existing
  architecture rather than needing new code.
- **Lost if the contributing player disconnects mid-attempt?** No -
  progress is applied synchronously the instant a contribution resolves;
  there's no multi-step "in-flight" contribution state that a dropped
  connection could leave half-applied.
- **Duplicated by rapid clicking?** No - the ability cooldown
  (`ABILITY_COOLDOWN_MS`) applies the moment a contribution succeeds, before
  the response is even sent, so a second `ability:use` arriving before the
  first one's effects are visible client-side still lands after the
  server-side state mutation and gets rejected on cooldown, not applied
  twice.
- **Duplicated across a reconnect (e.g., a client retries a message it's
  unsure landed)?** Not currently guarded by a request-id/idempotency key -
  if a client-side bug caused the same logical `ability:use` to be sent
  twice, both would be independently validated and (cooldown permitting)
  both would apply. This is a real gap, not a false one: worth revisiting
  if the client later needs optimistic retries. It doesn't
  affect the reconnect flow itself, which never resends past actions - only
  the latest state.
- **Can two players' simultaneous contributions race each other?** No -
  Node's single-threaded event loop processes each incoming WebSocket
  message to completion before the next one starts; there's no `await`
  inside `useAbilityOnTask()` between reading and writing task state, so
  two near-simultaneous contributions are simply applied one after the
  other, each against the correct prior value.
