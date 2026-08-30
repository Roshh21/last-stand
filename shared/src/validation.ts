import {
  LOBBY_CHAT_MAX_MESSAGE_LENGTH,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from "./constants.js";

/**
 * Used on both sides: the client uses these to give instant feedback, the
 * server uses them as the actual (authoritative) validation. Never trust the
 * client's own check.
 */

export function sanitizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, NICKNAME_MAX_LENGTH);
}

export function isValidNickname(nickname: string): boolean {
  const trimmed = nickname.trim();

  return trimmed.length >= NICKNAME_MIN_LENGTH && trimmed.length <= NICKNAME_MAX_LENGTH;
}

export function sanitizeChatText(raw: string): string {
  return raw.trim().slice(0, LOBBY_CHAT_MAX_MESSAGE_LENGTH);
}

export function isValidChatText(text: string): boolean {
  const trimmed = text.trim();

  return trimmed.length > 0 && trimmed.length <= LOBBY_CHAT_MAX_MESSAGE_LENGTH;
}
