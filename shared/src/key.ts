/**
 * The secret "sentence/code/riddle" one traitor holds at a time (P31). A
 * static shared pool - the server (server/src/match/key.ts) picks one at
 * random per match and owns all key state (current holder, transfer
 * history). Only the pool of possible phrases is shared data; the
 * selection/assignment logic is server-only, matching the elements.ts /
 * server/match/elements.ts split.
 */
export const KEY_PHRASES: string[] = [
  "The tide remembers what the sand forgets.",
  "Three knocks at low tide, none at high.",
  "The furnace burns brightest just before it dies.",
  "Count the gulls; the odd one carries the word.",
  "What the compass hides, the current knows.",
  "A locked door needs no key if no one asks.",
  "The last ember tells no lies, only truths no one wants.",
  "North of the wreck, the map ends where the truth begins.",
];

/** P32: "prevent the key from being duplicated, lost, or transferred to an eliminated player." */
export type KeyTransferRejectReason =
  | "not_in_match"
  | "not_key_holder"
  | "cannot_message_self"
  | "target_not_found"
  | "target_disconnected"
  | "no_open_thread";
