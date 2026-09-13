# Elements & Abilities

Covers Stage C (P15-P19): every player's elemental identity and the one
dual-use ability it grants them. See `shared/src/elements.ts` and
`shared/src/abilities.ts` for the data, and `server/src/match/Match.ts`
(`useAbility` and its two private helpers) for the server-authoritative
resolution.

## Element assignment (P15)

Six elements - Fire, Water, Nature, Lightning, Earth, Wind - each with a
canonical color. `assignElements()` (`server/src/match/elements.ts`)
round-robins a shuffled player list through a shuffled element order, so
counts differ by at most one across the match; with six or fewer players,
every element assigned is distinct (exploited directly in the P15-P24
integration test to get deterministic coverage of every element in one
run).

**Deviation from the roadmap's wording:** P15 asks for assignment "balanced
across each team." There are no teams yet - Stage F (P29+) is what splits
the match into teams at all. Assignment here balances across the *whole
match's player pool* instead, which is the closest honest reading available
before teams exist. Once Stage F lands, this should be called once per team
rather than once per match; nothing about today's implementation blocks
that.

**Avatar color now means something.** P12's placeholder avatar was an
arbitrary color hashed from `playerId`. As of P15, avatar color is the
player's element's canonical color instead (`server/src/match/avatar.ts`,
`buildAvatar`) - a glance at the roster or map tells you who's playing what.
The shape is still a `playerId`-hash placeholder, kept only so two players
sharing an element remain visually distinguishable from each other.

## Ability data model (P16)

V1 keeps this simple: **one element = one ability**, so there's no separate
ability-id to select or a per-ability cooldown map - a single
`abilityReadyAt` timestamp per player (`MatchPlayerState`, alongside the
existing `movementReadyAt`) is all "a cooldown tracker per player, per
ability" collapses to when a player only ever has one ability. If a future
stage gives players multiple abilities, this is the field that would need
to become a map.

Every ability targets either a **zone** (a path) or a **task**
(`AbilityTargetKind`). The generic `ability:use { targetKind, targetId }`
message (P16: "a generic 'use ability' message") is validated in this
order, matching P16's own ordering ("element match, cooldown, and target"):

1. Element match - trivially true in V1, since the ability used is always
   the one tied to the player's own element; this step is a placeholder for
   if players ever get to choose among several abilities.
2. Cooldown - `now < player.abilityReadyAt` -> `on_cooldown`.
3. Target - depends on `targetKind`; see below.

Rejections are reported via `ability:rejected` (see
`shared/src/abilities.ts`'s `AbilityRejectReason`) directly to the
requester, mirroring the existing `match:moveRejected` pattern from Stage B.

## The dual-use principle, made concrete (P17, P18)

The roadmap's core design rule - "no action should ever prove guilt" -
shaped how these abilities work more than any specific fictional verb did.
Rather than giving each ability two different *code branches* selected by
target (which would make the helpful and disruptive uses visibly distinct
events an observer could tell apart), every zone-targeting ability
**toggles** the target zone's blocked state:

- Fire, Water, Nature, Earth, and Wind can each target their own zone or an
  adjacent one, flipping it from open to blocked or blocked to open.
- **Lightning has no zone effect at all** (`canTargetZone: false`) - the
  roadmap's own text for Lightning ("powers or overloads an electrical task
  component") never mentions a path, unlike every other element.

The result: the *same* button, used by the *same* element, either helps
(clearing a path someone needs) or hurts (sealing one off) depending purely
on the zone's state at that moment - which no other player can see just
from watching the action happen. That ambiguity is the point, not a bug to
resolve later.

Movement was extended to respect this: `checkMove()`
(`server/src/match/movement.ts`) now takes `targetZoneBlocked` and rejects
with `zone_blocked` if set, tested directly in
`server/tests/unit/movement.test.ts`.

Task-targeting abilities are covered below, since they're really P22's
mechanism (Stage D) - Stage C alone doesn't have tasks to point them at yet.

## The P22 sabotage lever, without a traitor system (Stage D crossover)

P22 explicitly describes a "traitor's help" producing a different (reduced,
plus-hidden-instability) outcome than a loyal player's - but traitor
*assignment* is Stage F (P29+), which doesn't exist yet. The roadmap's own
v0.5 checkpoint description resolves this explicitly: *"The traitor's
subtle-sabotage lever from P22 is quietly live underneath it."* Read
literally, that means the mechanism should be real code today, just never
triggered by anything reachable in actual play.

That's exactly how it's built. `resolveTaskContribution()`
(`server/src/match/taskContribution.ts`) is a pure function taking an
`isSaboteur: boolean` alongside the element and task:

- Correct element, not a saboteur -> `TASK_NORMAL_CONTRIBUTION` (25 by
  default), zero instability.
- Correct element, *is* a saboteur -> `TASK_SABOTAGE_CONTRIBUTION` (10 by
  default, not zero - a dead no-op would itself be a tell), plus
  `TASK_SABOTAGE_INSTABILITY` hidden instability.
- Wrong element -> nothing either way.

**`Match.useAbilityOnTask()` always calls this with `isSaboteur: false`.**
There is no message, no random assignment, no admin hook - nothing in
P15-P24 ever sets it any other way. The two branches are proven distinct
entirely through `server/tests/unit/taskContribution.test.ts`, which calls
the pure function directly with both values and asserts: sabotage still
nudges progress forward (not zero), always adds instability, and - critical
to P22's "never let the client receive a flag" requirement - produces a
result with the *exact same shape* either way, so there is no field a
client could ever inspect to tell which path ran.

`instability` and the per-contribution `contributionLog` live only on the
server's internal task state (`TaskRuntimeState` in `Match.ts`) and are
never included in `TaskStateDTO`. The log exists for Stage H's future
accusation mechanics (P22: "log the true cause server-side... for later
accusation mechanics") - right now every entry it will ever contain has
`isSaboteur: false`, which is expected and correct until Stage F exists.

**What this deliberately does not do:** it does not add a `role` or `team`
field anywhere, does not add any way to become a saboteur through gameplay,
and does not implement delayed task failure from accumulated instability
(that's P37, Stage G). The hook is real and tested; nothing calls it yet.

## Ability UX (P19)

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
  exactly matching P19's example text.
