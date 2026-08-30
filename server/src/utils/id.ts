import { randomBytes, randomInt, randomUUID } from "node:crypto";

import {
  PLAYER_ID_BYTES,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SESSION_TOKEN_BYTES,
} from "@last-stand/shared";

export function generatePlayerId(): string {
  return `p_${randomBytes(PLAYER_ID_BYTES).toString("hex")}`;
}

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

export function generateMatchId(): string {
  return `m_${randomUUID()}`;
}

export function generateMessageId(): string {
  return randomUUID();
}

/** Short, shareable room code. Uniqueness against active rooms is the caller's job. */
export function generateRoomCode(): string {
  let code = "";

  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }

  return code;
}
