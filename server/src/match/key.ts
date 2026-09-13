import { randomInt } from "node:crypto";

import { KEY_PHRASES } from "@last-stand/shared";

export interface InitialKeyAssignment {
  holderId: string;
  content: string;
}

/**
 * P31: "randomly select one traitor at match start to hold the key." Actual
 * key STATE (current holder, transfer history) lives directly on `Match` -
 * this just picks who starts with it and what it says.
 */
export function assignInitialKey(traitorPlayerIds: string[]): InitialKeyAssignment {
  if (traitorPlayerIds.length === 0) {
    throw new Error("Cannot assign a key with no traitors in the match");
  }

  const holderId = traitorPlayerIds[randomInt(traitorPlayerIds.length)];
  const content = KEY_PHRASES[randomInt(KEY_PHRASES.length)];

  return { holderId, content };
}
