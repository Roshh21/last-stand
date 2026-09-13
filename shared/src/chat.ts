/**
 * Lobby chat placeholder (P6) - unchanged, still used pre-game. The real
 * in-match communication system (global, team, and limited private/traitor
 * chat) is Stage E/F below and is a separate, richer system.
 */
export interface LobbyChatMessageDTO {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  sentAt: number;
}

/**
 * In-match chat (P25-P28, P32-P33). "private" and "traitor" messages are
 * never broadcast - the server sends personalized copies only to the two
 * participants, each with `otherPlayerId` set to *the other* participant,
 * so a client can bucket messages into the right thread regardless of
 * which side of the conversation it's on.
 */
export type ChatChannel = "global" | "team" | "private" | "traitor";

export interface MatchChatMessageDTO {
  id: string;
  channel: ChatChannel;
  playerId: string;
  nickname: string;
  text: string;
  sentAt: number;
  /** Present only for "private"/"traitor" messages - the other thread participant. */
  otherPlayerId?: string;
  /** P26: a team-scoped announcement ("Alice reconnected") rather than a player's own message. */
  isSystem?: boolean;
}

export type ChatRejectReason =
  | "not_in_match"
  | "rate_limited"
  | "invalid_channel"
  | "no_team"
  | "no_open_thread"
  | "no_starts_remaining"
  | "cannot_message_self"
  | "target_not_found"
  | "target_disconnected"
  | "channel_not_unlocked"
  | "invalid_input";
