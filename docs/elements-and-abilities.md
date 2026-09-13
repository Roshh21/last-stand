# Elements & Abilities

every player's elemental identity and the one
dual-use ability it grants them. See `shared/src/elements.ts` and
`shared/src/abilities.ts` for the data, and `server/src/match/Match.ts`
(`useAbility` and its two private helpers) for the server-authoritative
resolution.

## Element assignment

Six elements - Fire, Water, Nature, Lightning, Earth, Wind - each with a
canonical color. `assignElements()` (`server/src/match/elements.ts`)
round-robins a shuffled player list through a shuffled element order, so
counts differ by at most one across the match; with six or fewer players,
every element assigned is distinct (covered directly in the integration tests to get deterministic coverage of every element in one
run).

**Element assignment is balanced across the match.** `assignElements()` round-robins a shuffled player list through a shuffled element order, so counts differ by at most one. Team assignment is handled separately.

**Avatar color now means something.** The earlier placeholder avatar was an
arbitrary color hashed from `playerId`. In the current implementation, avatar color is the
player's element's canonical color instead (`server/src/match/avatar.ts`,
`buildAvatar`) - a glance at the roster or map tells you who's playing what.
The shape is still a `playerId`-hash placeholder, kept only so two players
sharing an element remain visually distinguishable from each other.

## Ability data model

V1 keeps this simple: **one element = one ability**, so there's no separate
ability-id to select or a per-ability cooldown map - a single
`abilityReadyAt` timestamp per player (`MatchPlayerState`, alongside the
existing `movementReadyAt`) is all "a cooldown tracker per player, per
ability" collapses to when a player only ever has one ability. The current one-ability-per-element model intentionally keeps this state as a single timestamp.

Every ability targets either a **zone** (a path) or a **task**
(`AbilityTargetKind`). The generic `ability:use { targetKind, targetId }`
message (a generic `ability:use` message) is validated in this
order, using the validation order: element match, cooldown, then target:

1. Element match - trivially true in V1, since the ability used is always
   the one tied to the player's own element; this step is a placeholder for
   if players ever get to choose among several abilities.
2. Cooldown - `now < player.abilityReadyAt` -> `on_cooldown`.
3. Target - depends on `targetKind`; see below.

Rejections are reported via `ability:rejected` (see
`shared/src/abilities.ts`'s `AbilityRejectReason`) directly to the
requester, mirroring the existing `match:moveRejected` pattern from the movement system.

## The dual-use principle

A core design rule is that no action should directly prove guilt. That principle shapes how these abilities work.
Rather than giving each ability two different *code branches* selected by
target (which would make the helpful and disruptive uses visibly distinct
events an observer could tell apart), every zone-targeting ability
**toggles** the target zone's blocked state:

- Fire, Water, Nature, Earth, and Wind can each target their own zone or an
  adjacent one, flipping it from open to blocked or blocked to open.
- **Lightning has no zone effect at all** (`canTargetZone: false`) - the
  Lightning's electrical-task behavior never mentions a path, unlike every other element.

The result: the *same* button, used by the *same* element, either helps
(clearing a path someone needs) or hurts (sealing one off) depending purely
on the zone's state at that moment - which preserves ambiguity between helpful and disruptive use.

Movement was extended to respect this: `checkMove()`
(`server/src/match/movement.ts`) now takes `targetZoneBlocked` and rejects
with `zone_blocked` if set, tested directly in
`server/tests/unit/movement.test.ts`.

Task-targeting abilities are covered below with the task-system behavior.

## Task sabotage resolution

Task contribution resolution supports both normal and sabotage outcomes through a pure server-side function. The active gameplay path currently supplies `isSaboteur: false`, while the alternate branch is covered by unit tests. `resolveTaskContribution()`
(`server/src/match/taskContribution.ts`) is a pure function taking an
`isSaboteur: boolean` alongside the element and task:

- Correct element, not a saboteur -> `TASK_NORMAL_CONTRIBUTION` (25 by
  default), zero instability.
- Correct element, *is* a saboteur -> `TASK_SABOTAGE_CONTRIBUTION` (10 by
  default, not zero - a dead no-op would itself be a tell), plus
  `TASK_SABOTAGE_INSTABILITY` hidden instability.
- Wrong element -> nothing either way.

**`Match.useAbilityOnTask()` always calls this with `isSaboteur: false`.**
There is no message, no random assignment, no admin hook - nothing in the current gameplay path sets it to `true`. The two branches are proven distinct
entirely through `server/tests/unit/taskContribution.test.ts`, which calls
the pure function directly with both values and asserts: sabotage still
nudges progress forward (not zero), always adds instability, and - critical
to the hidden-information guarantee - produces a
result with the *exact same shape* either way, so there is no field a
client could ever inspect to tell which path ran.

`instability` and the per-contribution `contributionLog` live only on the
server's internal task state (`TaskRuntimeState` in `Match.ts`) and are
never included in `TaskStateDTO`. The log remains server-only and is not included in `TaskStateDTO`; current gameplay entries use `isSaboteur: false`.

**What this deliberately does not do:** it does not add a `role` or `team`
field anywhere, does not add any way to become a saboteur through gameplay,
and does not implement delayed task failure from accumulated instability
No delayed task failure from accumulated instability is currently applied. The hook is real and tested; nothing calls it yet.

## Ability UX

- Cooldown countdown: the ability panel reads `abilityReadyAt` against a
  client-side ticking clock (`useNow`, the same pattern used for the
  movement cooldown and match-start countdown) rather than calling
  `Date.now()` directly during render.
- Rejection feedback: `ability:rejected` carries a reason code, translated
  to a short human sentence client-side (`AbilityPanel.tsx`,
  `describeAbilityRejection`) - "still recovering," "not enough people here
  working together yet," and so on.
- World-effect cue: a blocked zone renders with a dashed red outline and a
  "no entry" mark on the map (`IslandMapSvg.tsx`); task progress bars
  animate via a CSS transition.
- Ability-use log: every successful use broadcasts `ability:used` to the
  whole match with only `{ element, zoneId }` - no `playerId`, no
  `nickname`. The client renders this as "Someone used Fire in Forest,"
  using the same anonymous event format.
