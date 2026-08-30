/**
 * Lobby chat placeholder (P6). This is intentionally minimal - no filtering,
 * moderation, or channel scoping. The real communication system (global,
 * team, and limited private chat) is Stage E (P25-P28) and replaces this.
 */

export interface LobbyChatMessageDTO {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  sentAt: number;
}
