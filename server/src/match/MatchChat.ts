import {
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  MATCH_CHAT_HISTORY_LIMIT,
  PRIVATE_CHAT_MAX_STARTS,
  isValidChatText,
  maskProfanity,
  sanitizeChatText,
  type ChatRejectReason,
  type MatchChatMessageDTO,
  type PlayerRole,
  type PrivateThreadSummaryDTO,
} from "@last-stand/shared";

import { generateMessageId } from "../utils/id.js";
import { RateLimiter } from "../utils/RateLimiter.js";

export interface ChatPlayerInfo {
  nickname: string;
  teamId: string;
  connected: boolean;
  role: PlayerRole;
}

export type PlayerLookup = (playerId: string) => ChatPlayerInfo | undefined;

export type ChatResult<T> = { ok: true; value: T } | { ok: false; reason: ChatRejectReason };

/** One message delivered to one recipient - private/traitor sends produce two of these (one per participant). */
export interface ChatDelivery {
  recipientPlayerId: string;
  message: MatchChatMessageDTO;
}

interface PrivateThread {
  participants: [string, string];
  messages: MatchChatMessageDTO[];
  signaledBy: Set<string>;
  traitorChannelUnlocked: boolean;
  openedAt: number;
}

function threadKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/**
 * Owns every in-match chat channel. `Match` provides a lookup for the
 * player context (nickname, team, connection, role) it doesn't otherwise
 * need to duplicate - this class only ever reads that, never mutates it.
 */
export class MatchChat {
  private readonly lookup: PlayerLookup;
  private readonly globalHistory: MatchChatMessageDTO[] = [];
  private readonly teamHistory = new Map<string, MatchChatMessageDTO[]>();
  private readonly threadsByKey = new Map<string, PrivateThread>();
  private readonly remainingStarts = new Map<string, number>();
  private readonly rateLimiter = new RateLimiter(CHAT_RATE_LIMIT_COUNT, CHAT_RATE_LIMIT_WINDOW_MS);

  constructor(lookup: PlayerLookup, playerIds: string[]) {
    this.lookup = lookup;

    for (const playerId of playerIds) {
      this.remainingStarts.set(playerId, PRIVATE_CHAT_MAX_STARTS);
    }
  }

  private buildMessage(params: {
    channel: MatchChatMessageDTO["channel"];
    playerId: string;
    nickname: string;
    text: string;
    now: number;
    otherPlayerId?: string;
    isSystem?: boolean;
  }): MatchChatMessageDTO {
    return {
      id: generateMessageId(),
      channel: params.channel,
      playerId: params.playerId,
      nickname: params.nickname,
      text: params.text,
      sentAt: params.now,
      ...(params.otherPlayerId ? { otherPlayerId: params.otherPlayerId } : {}),
      ...(params.isSystem ? { isSystem: true } : {}),
    };
  }

  private pushCapped(list: MatchChatMessageDTO[], message: MatchChatMessageDTO): void {
    list.push(message);

    if (list.length > MATCH_CHAT_HISTORY_LIMIT) {
      list.shift();
    }
  }

  private validateAndCleanText(playerId: string, rawText: string, now: number): ChatResult<string> {
    if (!this.rateLimiter.tryConsume(playerId, now)) {
      return { ok: false, reason: "rate_limited" };
    }

    const cleaned = maskProfanity(sanitizeChatText(rawText));

    if (!isValidChatText(cleaned)) {
      return { ok: false, reason: "invalid_input" };
    }

    return { ok: true, value: cleaned };
  }

  // --- P25: global chat ---

  sendGlobal(playerId: string, rawText: string, now: number): ChatResult<MatchChatMessageDTO> {
    const sender = this.lookup(playerId);

    if (!sender) {
      return { ok: false, reason: "not_in_match" };
    }

    const cleaned = this.validateAndCleanText(playerId, rawText, now);

    if (!cleaned.ok) {
      return cleaned;
    }

    const message = this.buildMessage({
      channel: "global",
      playerId,
      nickname: sender.nickname,
      text: cleaned.value,
      now,
    });

    this.pushCapped(this.globalHistory, message);

    return { ok: true, value: message };
  }

  getGlobalHistory(): MatchChatMessageDTO[] {
    return [...this.globalHistory];
  }

  // --- P26: team chat ---

  sendTeam(playerId: string, rawText: string, now: number): ChatResult<MatchChatMessageDTO> {
    const sender = this.lookup(playerId);

    if (!sender) {
      return { ok: false, reason: "not_in_match" };
    }

    const cleaned = this.validateAndCleanText(playerId, rawText, now);

    if (!cleaned.ok) {
      return cleaned;
    }

    const message = this.buildMessage({
      channel: "team",
      playerId,
      nickname: sender.nickname,
      text: cleaned.value,
      now,
    });

    this.pushCapped(this.getOrCreateTeamHistory(sender.teamId), message);

    return { ok: true, value: message };
  }

  /** P26: a team-scoped announcement, not a player's own message (e.g. "Alice reconnected"). */
  postTeamSystemMessage(teamId: string, text: string, now: number): MatchChatMessageDTO {
    const message = this.buildMessage({
      channel: "team",
      playerId: "system",
      nickname: "System",
      text,
      now,
      isSystem: true,
    });

    this.pushCapped(this.getOrCreateTeamHistory(teamId), message);

    return message;
  }

  getTeamHistory(teamId: string): MatchChatMessageDTO[] {
    return [...this.getOrCreateTeamHistory(teamId)];
  }

  private getOrCreateTeamHistory(teamId: string): MatchChatMessageDTO[] {
    const existing = this.teamHistory.get(teamId);

    if (existing) {
      return existing;
    }

    const created: MatchChatMessageDTO[] = [];

    this.teamHistory.set(teamId, created);

    return created;
  }

  // --- P27: private chat ---

  getRemainingStarts(playerId: string): number {
    return this.remainingStarts.get(playerId) ?? 0;
  }

  /** P32: key transfer is only allowed "inside an active private chat." */
  hasOpenThread(a: string, b: string): boolean {
    return this.threadsByKey.has(threadKey(a, b));
  }

  private getThread(a: string, b: string): PrivateThread | undefined {
    return this.threadsByKey.get(threadKey(a, b));
  }

  openThread(playerId: string, targetId: string, now: number): ChatResult<ChatPlayerInfo> {
    if (playerId === targetId) {
      return { ok: false, reason: "cannot_message_self" };
    }

    const opener = this.lookup(playerId);
    const target = this.lookup(targetId);

    if (!opener) {
      return { ok: false, reason: "not_in_match" };
    }

    if (!target) {
      return { ok: false, reason: "target_not_found" };
    }

    if (!target.connected) {
      return { ok: false, reason: "target_disconnected" };
    }

    const existing = this.getThread(playerId, targetId);

    if (existing) {
      return { ok: true, value: target };
    }

    const remaining = this.getRemainingStarts(playerId);

    if (remaining <= 0) {
      return { ok: false, reason: "no_starts_remaining" };
    }

    this.remainingStarts.set(playerId, remaining - 1);
    this.threadsByKey.set(threadKey(playerId, targetId), {
      participants: [playerId, targetId].sort() as [string, string],
      messages: [],
      signaledBy: new Set(),
      traitorChannelUnlocked: false,
      openedAt: now,
    });

    return { ok: true, value: target };
  }

  sendPrivate(playerId: string, targetId: string, rawText: string, now: number): ChatResult<ChatDelivery[]> {
    return this.sendWithinThread(playerId, targetId, rawText, now, "private", (thread) => thread !== undefined);
  }

  sendTraitor(playerId: string, targetId: string, rawText: string, now: number): ChatResult<ChatDelivery[]> {
    return this.sendWithinThread(
      playerId,
      targetId,
      rawText,
      now,
      "traitor",
      (thread) => thread?.traitorChannelUnlocked === true,
    );
  }

  private sendWithinThread(
    playerId: string,
    targetId: string,
    rawText: string,
    now: number,
    channel: "private" | "traitor",
    isAllowed: (thread: PrivateThread | undefined) => boolean,
  ): ChatResult<ChatDelivery[]> {
    const sender = this.lookup(playerId);
    const target = this.lookup(targetId);

    if (!sender) {
      return { ok: false, reason: "not_in_match" };
    }

    if (!target) {
      return { ok: false, reason: "target_not_found" };
    }

    const thread = this.getThread(playerId, targetId);

    if (!isAllowed(thread)) {
      return { ok: false, reason: channel === "traitor" ? "channel_not_unlocked" : "no_open_thread" };
    }

    const cleaned = this.validateAndCleanText(playerId, rawText, now);

    if (!cleaned.ok) {
      return cleaned;
    }

    const senderCopy = this.buildMessage({
      channel,
      playerId,
      nickname: sender.nickname,
      text: cleaned.value,
      now,
      otherPlayerId: targetId,
    });
    const recipientCopy = { ...senderCopy, otherPlayerId: playerId };

    this.pushCapped(thread!.messages, senderCopy);

    return {
      ok: true,
      value: [
        { recipientPlayerId: playerId, message: senderCopy },
        { recipientPlayerId: targetId, message: recipientCopy },
      ],
    };
  }

  /** P33: a subtle, non-verbal opt-in signal. Only unlocks the traitor channel if BOTH participants actually are traitors. */
  sendSignal(playerId: string, targetId: string): ChatResult<{ traitorChannelUnlocked: boolean }> {
    const thread = this.getThread(playerId, targetId);

    if (!thread) {
      return { ok: false, reason: "no_open_thread" };
    }

    thread.signaledBy.add(playerId);

    const [a, b] = thread.participants;
    const bothSignaled = thread.signaledBy.has(a) && thread.signaledBy.has(b);

    if (bothSignaled && !thread.traitorChannelUnlocked) {
      const infoA = this.lookup(a);
      const infoB = this.lookup(b);

      if (infoA?.role === "traitor" && infoB?.role === "traitor") {
        thread.traitorChannelUnlocked = true;
      }
    }

    return { ok: true, value: { traitorChannelUnlocked: thread.traitorChannelUnlocked } };
  }

  getThreadHistory(playerId: string, otherPlayerId: string): MatchChatMessageDTO[] | undefined {
    const thread = this.getThread(playerId, otherPlayerId);

    return thread ? [...thread.messages] : undefined;
  }

  getPrivateThreadSummaries(playerId: string): PrivateThreadSummaryDTO[] {
    const summaries: PrivateThreadSummaryDTO[] = [];

    for (const thread of this.threadsByKey.values()) {
      if (!thread.participants.includes(playerId)) {
        continue;
      }

      const otherPlayerId = thread.participants.find((id) => id !== playerId)!;
      const otherInfo = this.lookup(otherPlayerId);

      summaries.push({
        otherPlayerId,
        otherNickname: otherInfo?.nickname ?? "(disconnected)",
        signaledByMe: thread.signaledBy.has(playerId),
        signaledByOther: thread.signaledBy.has(otherPlayerId),
        traitorChannelUnlocked: thread.traitorChannelUnlocked,
        openedAt: thread.openedAt,
      });
    }

    return summaries.sort((a, b) => a.openedAt - b.openedAt);
  }
}
