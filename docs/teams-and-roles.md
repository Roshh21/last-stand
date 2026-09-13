# Teams, Hidden Roles & the Key

This is the social-deduction layer of the game. See `docs/security-audit.md` for how the
secrecy guarantees below are actually verified, not just asserted.

## The public/private split

Before this system, `MatchSnapshotDTO` was the *only* view of a match, and
it was the same for everyone. That stops being true here: a role, and
whether you hold the key, are facts that are true about you but must never
be visible to anyone else. `Match` now produces two outputs:

- `getSnapshot()` - unchanged in spirit, still identical for every
  recipient. Gained one new public field this system: `teamId` per player
  and a `teams` list (team membership is public).
- `getPrivateStateFor(playerId)` - new. Computed fresh per player, sent
  only to that one player, every tick. Contains `role`, `hasKey`,
  `keyContent` (null unless `hasKey`), remaining private-chat starts, and
  open-thread summaries.

Every hidden-information guarantee in this system comes down to: nothing
that belongs in `PrivateMatchStateDTO` is ever, anywhere, also written into
`MatchSnapshotDTO` or any broadcast payload.

## Teams

**Island's real minimum is 5 players, not the small dev-testing numbers
used elsewhere in this codebase's tests.** `MIN_ROOM_PLAYERS = 5` - a room
can't start with fewer, enforced the same way any other ready-check is
(`canStartRoom`, unchanged). Five is also exactly enough to form **one**
team under the existing team-size logic (`calculateTeamCount(5) === 1`,
since 5 is closer to the 6-player target than splitting into two tiny
teams would be) - so a minimum game is: one room, one team, five players,
each with an element and a role, and - per `assignRoles` - exactly one of
them a traitor. No special-casing was needed for this; it falls out of the
existing `calculateTeamCount`/`assignTeams`/`assignRoles` pipeline once the
room-level minimum was raised to 5.

`assignTeams()` (`server/src/match/teams.ts`) targets `TARGET_TEAM_SIZE`
(6) per team, never going below `MIN_TEAM_SIZE` (2) - the floor exists so
every team can hold at least one traitor *and* at least one loyal player.
`calculateTeamCount()` is unit-tested across the full 5-50 player range,
including the full supported 5-50 player range and even team sizing.

**The re-roll safeguard**: round-robin distribution
of a shuffled player list can't actually produce an uneven or empty team by
construction, so a re-roll should never actually trigger in practice. It's
implemented anyway (`assignTeams` retries the shuffle up to 5 times,
validating evenness each time, before falling back to a guaranteed-valid
deterministic distribution) so that if a later change to the distribution strategy *did* introduce a way to produce an invalid split, a test would
catch it rather than it silently shipping. See
`server/tests/unit/teams.test.ts`.

## Hidden traitor roles

`assignRoles()` (`server/src/match/roles.ts`) gives each team exactly one
traitor - "at least one," read as the simplest, most predictable choice
that satisfies it. Two traitors on different teams have no way to learn
about each other: role assignment isn't grouped or cross-referenced
anywhere a client could reach, and each player's own
`PrivateMatchStateDTO` only ever contains *their own* role.

The client-side reveal (`RoleRevealOverlay.tsx`) shows once per match,
tracked by `matchId` so a re-render or a stray extra `match:privateState`
tick doesn't re-trigger it.

## The key

`assignInitialKey()` (`server/src/match/key.ts`) hands the key to one
random traitor at match start, with content drawn from a small shared pool
of riddle-like phrases (`shared/src/key.ts`). Holder and content live as
plain fields on `Match` (`keyHolderId`, `keyContent`) - there's exactly one
holder at any moment by construction, so "only ever exactly one player's
client receives the key content" (the single-holder guarantee) isn't something that needs
active enforcement so much as something the data model makes impossible to
violate.

## Passing the key

`Match.transferKey()` enforces every safeguard the team-assignment safeguards:

- **"Usable only inside an active private chat"** - `hasOpenThread()` is
  checked before any transfer; there's no other code path that moves the
  key.
- **Never duplicated or lost** - `keyHolderId` is a single field
  reassigned atomically; there's no window where it's null or points at
  two people.
- **Never transferred to an eliminated player** - there's no elimination
  system currently, so `target.connected` is the closest
  available analog and is what's actually checked today. Worth revisiting
  once a real "eliminated" state exists.

Critically, the recipient's own role is **never checked**. A traitor can
hand the key to anyone they have an open thread with, loyal or traitor -
that uncertainty is the "risky" part the intended uncertainty of the mechanic. The server
doesn't protect anyone from a bad decision here.

## Traitor coordination

Two traitors "finding each other" isn't automatic - it requires **both**
sides to opt in with a `privateChat:signal` (a "subtle non-verbal
gesture," using a subtle non-verbal gesture, deliberately not a text
message with explicit content). `MatchChat.sendSignal()` records who's
signaled within a thread and, the moment *both* participants have, checks
whether both are actually traitors. Only then does
`traitorChannelUnlocked` flip true for that thread, unlocking
`traitorChat:send` between exactly those two players.

**Two important properties, both verified in
`server/tests/integration/teamsRolesAndChat.test.ts`:**

- A traitor signaling a loyal player (or two loyal players signaling each
  other) never unlocks anything, and never produces any distinguishable
  server response - the rejection a loyal pair gets from attempting
  `traitorChat:send` afterward is identical in shape to what a
  never-signaled pair would get.
- The unlock is never announced or flagged anywhere public - it's visible
  only in the two participants' own `openThreads` summaries.

**A worth-naming, likely-intentional side effect:** if a traitor signals a
teammate and the channel *doesn't* unlock, the traitor can infer their
teammate probably isn't a fellow traitor (since they already know their
own role). This is real information leakage - but it comes from the
player's own deduction, not from anything the server explicitly reveals,
and it mirrors exactly the kind of risk  says the key-passing mechanic
should have ("attempt to pass the key privately and *riskily*"). Treated
here as intentional social-deduction tension rather than a bug to patch
over.
