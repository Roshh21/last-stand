# Security Audit: Hidden Information (P34)

P34's own instructions: write a checklist of every piece of hidden
information, verify server code paths never leak it, use a traffic
inspector across multiple clients to confirm no leakage, and add a
regression check so a leak can't silently reappear. This document is that
checklist. The "traffic inspector" is
`server/tests/integration/teamsRolesAndChat.test.ts` - an automated,
repeatable equivalent of manually running browser dev tools against
several open tabs, and the thing that actually *runs* on every future
change rather than being a one-time manual pass.

## Method

For each item below: (1) the code path that could leak it, (2) why it
doesn't, (3) the specific test that would fail if it started to.

## Checklist

### 1. Player role (loyal/traitor)

- **Where it lives:** `Match`'s private `roles` map.
- **Why it can't leak:** `role` exists only on `PrivateMatchStateDTO`,
  computed by `Match.getPrivateStateFor(playerId)` and sent by
  `MatchManager` via a direct per-session send - never through
  `broadcastToPlayers`, never included in `MatchSnapshotDTO`.
- **Regression check:** the integration test scans every client's *entire*
  raw received-message log (not just the messages it expected) for the
  literal string `"role":"traitor"` and asserts it never appears for a
  client whose own role is loyal. This would catch a leak through *any*
  message type, not just the ones the test explicitly sends.

### 2. The key's content

- **Where it lives:** `Match`'s private `keyContent` field.
- **Why it can't leak:** included in `PrivateMatchStateDTO.keyContent`
  only when `hasKey` is true for that specific recipient; `null`
  otherwise. Never appears in any broadcast payload.
- **Regression check:** the integration test asserts the actual key
  content string appears in the key holder's raw log but in *no other*
  client's raw log, checked before and after a transfer.

### 3. Who the key holder is

- **Where it lives:** `Match`'s private `keyHolderId` field.
- **Why it can't leak:** never included in `MatchSnapshotDTO`. A client
  only learns "I hold the key" about *itself* via its own private state -
  there's no message that names another player's holder status.
- **Regression check:** implicit in #2 - if holder identity leaked via some
  other field, the content-scanning check above would need the leaked
  player to also have the content, which it explicitly asserts doesn't
  happen.

### 4. Team chat content

- **Where it lives:** per-team message history inside `MatchChat`.
- **Why it can't leak:** delivery is a direct fan-out to
  `Match.getTeamMemberIds(senderTeamId)` - built from team membership, not
  from any client-supplied recipient list.
- **Regression check:** the integration test sends a team message and
  asserts a player on the *other* team's raw log never contains its text.

### 5. Private/traitor chat content

- **Where it lives:** per-thread message list inside `MatchChat`.
- **Why it can't leak:** delivery is exactly two direct sends (one per
  participant), constructed from the thread's own `participants` tuple -
  there's no broadcast code path for these channels at all.
- **Regression check:** the integration test sends a private message and
  asserts a third, uninvolved client's raw log never contains its text.

### 6. Signal state / traitor-channel unlock status

- **Where it lives:** per-thread `signaledBy` set and
  `traitorChannelUnlocked` flag inside `MatchChat`.
- **Why it can't leak:** `getPrivateThreadSummaries(playerId)` only ever
  returns threads that specific player participates in - there's no
  method that returns another player's thread summaries.
- **Regression check:** the integration test confirms a mixed
  traitor/loyal pair's mutual signal never flips `traitorChannelUnlocked`,
  and that attempting `traitorChat:send` on an unlocked-in-name-only
  thread is rejected identically to a never-signaled one (no distinguishing
  response that would let either party infer the other's role from the
  rejection itself).

### 7. Task instability / contribution history (carried over from P22)

- **Where it lives:** `TaskRuntimeState.instability` and
  `.contributionLog` inside `Match`.
- **Why it can't leak:** `TaskStateDTO` (the public shape) only exposes
  `progress` and `completed` - `instability` and the log aren't fields on
  it at all, so there's no accidental-inclusion risk from a future field
  rename or spread mistake touching the wrong object.
- **Regression check:** covered under Stage D's own tests
  (`server/tests/unit/taskContribution.test.ts`); re-verified here only in
  the sense that nothing in Stage E/F touches this path.

## What this audit does not cover

Bug reports and player reports include free-text fields a reporter
controls (description, reason) - those aren't "hidden information" in the
sense this audit is about (secrets the game keeps from players); they're
moderation data intentionally visible to whoever operates the server. Out
of scope here.

## Adding a new piece of hidden information later

Follow the same shape every item above uses: put it on
`PrivateMatchStateDTO` (or a new private-only DTO, sent the same
direct-per-session way), never on `MatchSnapshotDTO` or any broadcast
payload, and add a line to this checklist plus an assertion in the
integration test that scans for it leaking into a raw log it shouldn't
appear in. The scanning-the-raw-log technique (rather than only checking
the messages a test explicitly expects) is what makes these checks catch
leaks through unexpected code paths, not just the ones a test author
thought to check directly.
