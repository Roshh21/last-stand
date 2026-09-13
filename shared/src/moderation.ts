/**
 * P28: "a basic profanity/slur filter or masking pass." This is
 * intentionally minimal - a small, generic word list with whole-word,
 * case-insensitive matching, masking matches with asterisks. A real
 * deployment should swap this for a proper moderation service; the point
 * here is that masking happens server-side, authoritatively, before a
 * message is ever broadcast - never trusted to the client.
 */
const FILTERED_WORDS = ["damn", "hell", "crap", "bastard", "bloody"];

const FILTER_PATTERN = new RegExp(`\\b(${FILTERED_WORDS.join("|")})\\b`, "gi");

export function maskProfanity(text: string): string {
  return text.replace(FILTER_PATTERN, (match) => "*".repeat(match.length));
}

/** P28: "a mute/report-player action reachable from chat." Mute is client-only (local filtering); report is persisted here. */
export interface PlayerReportInput {
  targetPlayerId: string;
  reason: string;
}

export interface PlayerReportRecord extends PlayerReportInput {
  id: string;
  reporterId: string;
  reporterNickname: string;
  matchId: string | null;
  submittedAt: number;
}
