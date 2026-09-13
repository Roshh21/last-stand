/**
 * Hidden-role types (P30-P33). `PlayerRole` and everything derived from it
 * is the whole reason this codebase splits "public" state (MatchSnapshotDTO,
 * identical for everyone) from "private" state (PrivateMatchStateDTO, sent
 * only to the one player it describes). See docs/security-audit.md for how
 * that separation is verified.
 */
export type PlayerRole = "loyal" | "traitor";

export interface PrivateThreadSummaryDTO {
  otherPlayerId: string;
  otherNickname: string;
  /** Whether *I* have sent the P33 non-verbal signal to this partner. */
  signaledByMe: boolean;
  /** Whether my partner has signaled *me*. Both true unlocks the traitor channel - if both are actually traitors. */
  signaledByOther: boolean;
  /** Only ever true for an actual traitor paired with another actual traitor (P33). */
  traitorChannelUnlocked: boolean;
  openedAt: number;
}

/**
 * Sent only to the one player it describes - never broadcast, never
 * included in any other player's view. See PrivateMatchStateDTO's use in
 * Match.getPrivateStateFor().
 */
export interface PrivateMatchStateDTO {
  role: PlayerRole;
  hasKey: boolean;
  /** Only non-null when hasKey is true. */
  keyContent: string | null;
  remainingPrivateChatStarts: number;
  openThreads: PrivateThreadSummaryDTO[];
}
