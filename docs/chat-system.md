# Chat System

Covers Stage E (P25-P28): global, team, and limited private chat, plus
basic moderation. See `shared/src/chat.ts` for the wire types and
`server/src/match/MatchChat.ts` for the server-authoritative implementation
every channel routes through.

This is a different, richer system from the lobby chat placeholder built in
P6 (`room:chat:*`) - that one still exists unchanged, scoped to the
pre-game room. Everything here is scoped to a `Match` and is
`match:chat:*` / `privateChat:*` / `traitorChat:*`.

## One service, four channels

`MatchChat` owns all four channels (`global`, `team`, `private`,
`traitor`) so rate limiting, profanity masking, and history capping are
implemented exactly once rather than four times. It never mutates player
state directly - `Match` hands it a `lookup(playerId)` callback returning
just what it needs (nickname, team, connection, role) so `MatchChat` can't
accidentally develop its own, possibly-stale copy of player state.

## Global chat (P25)

The simplest channel: `match:chat:send { channel: "global" }` broadcasts to
every player in the match. Two safeguards apply to every channel, not just
this one:

- **Rate limiting** (`server/src/utils/RateLimiter.ts`): a basic fixed-window
  limiter (`CHAT_RATE_LIMIT_COUNT` messages per `CHAT_RATE_LIMIT_WINDOW_MS`).
  A window is simpler than a sliding log and is what P25 asks for -
  "basic... spam protection," not a production-grade solution.
- **Profanity masking** (`shared/src/moderation.ts`): server-side,
  authoritative, before broadcast - the client never receives unmasked text
  it would have to censor itself. The word list is deliberately small and
  mild; see the file's own comment for why a real deployment should replace
  it with a proper moderation service.

History is capped at `MATCH_CHAT_HISTORY_LIMIT` and resent on reconnect via
`match:chat:history` - the same rehydration pattern Stage A established for
room chat.

## Team chat (P26)

`match:chat:send { channel: "team" }` resolves the sender's team
server-side (`Match.getTeamIdFor`) and broadcasts only to
`Match.getTeamMemberIds(teamId)` - a different player can never receive it
by any code path, because the fan-out list is built from team membership,
not from anything the client asserts. This is exercised directly in
`server/tests/integration/teamsRolesAndChat.test.ts`: a message is sent on
one team, and a player on the other team's entire raw message log is
searched and confirmed to never contain it.

**System messages:** the roadmap's own example ("Task completed in Power
Station") assumes team-scoped tasks, which Stage D doesn't have - tasks are
match-wide, shared by every team (see docs/task-system.md). Retrofitting
tasks to be per-team would be a real redesign of Stage D, out of scope
here. Instead, `Match.setConnected()` posts a genuinely team-scoped system
message ("Alice disconnected." / "Alice reconnected.") whenever a
teammate's connection status changes - the same underlying mechanism
(`MatchChat.postTeamSystemMessage`), a real and useful trigger rather than
a contrived one. System messages carry `isSystem: true` and a `"system"`
sender id so the client can style them distinctly and never offer a
mute/report action on them.

## Private chat (P27)

Private conversations are a **limited resource**, not free-form DMs:

- Each player starts a match with `PRIVATE_CHAT_MAX_STARTS` (3) "starts."
  `privateChat:open` spends one to create a thread with a target - unless a
  thread with that target already exists, in which case it's a no-op (you
  can't be charged twice for the same conversation).
- Once open, a thread stays open for the rest of the match. There's no
  limit on messages *within* an open thread - the scarce resource is
  starting new conversations, not sustaining existing ones.
- Every message is delivered as **two personalized copies**, one per
  participant, each with `otherPlayerId` set to *the other* side - so a
  client can bucket a private message into the right thread without any
  extra lookup, regardless of which side of the conversation it's on.
- A third party can never receive a private message: delivery is a direct
  per-recipient send (`MatchManager.handleSendPrivateChat`), never a
  broadcast. Verified directly in the integration test by asserting a
  bystander's entire raw message log never contains the private message's
  text.

Opening a thread also notifies *both* sides (`privateChat:opened`) - the
target should know someone wants to talk to them, the same as getting a DM
request in any real chat app.

## Moderation (P28)

- **Mute** is entirely client-side (`GameClient.toggleMute`) - a local
  filter over already-received messages, never sent to the server. No
  round-trip needed; the whole point is "I don't want to see this," which
  the client can do unilaterally.
- **Report** persists to `PlayerReportStore`
  (`server/src/moderation/PlayerReportStore.ts`), an append-only JSONL file
  mirroring `BugReportStore`'s exact pattern - same reasoning, same
  trade-offs, documented once in `docs/architecture.md` and not repeated
  here.
- **Unread indicators & message grouping**: `MatchChatPanel.tsx` tracks a
  per-tab "last seen count" client-side and shows a dot on any tab whose
  message count has grown past it since it was last viewed; consecutive
  messages from the same sender collapse the repeated nickname, matching
  the "message grouping" ask.

## What P28's "playtest all three channels at once" became

The roadmap's own DoD for P28 calls for a manual playtest with 3+ people.
The automated equivalent - and the more rigorous one, since it inspects
actual wire traffic rather than relying on a human noticing a leak - is
`server/tests/integration/teamsRolesAndChat.test.ts`'s 12-player test,
which exercises global, team, and private chat all at once in a single
match and asserts the scoping boundaries hold. See
`docs/security-audit.md` for the full audit this overlaps with.
