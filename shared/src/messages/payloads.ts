import type { AbilityRejectReason, AbilityTargetKind } from "../abilities.js";
import type { BugReportInput } from "../bugReport.js";
import type { ChatChannel, ChatRejectReason, LobbyChatMessageDTO, MatchChatMessageDTO } from "../chat.js";
import type { ElementId } from "../elements.js";
import type { KeyTransferRejectReason } from "../key.js";
import type { MatchSnapshotDTO, MoveRejectReason } from "../match.js";
import type { PlayerReportInput } from "../moderation.js";
import type { PrivateMatchStateDTO } from "../roles.js";
import type { RoomErrorCode, RoomStateDTO } from "../room.js";
import type { SessionErrorCode, SessionInfoDTO, SessionResumedDTO } from "../session.js";
import type { MessageEnvelope } from "./envelope.js";
import type { MessageType } from "./types.js";

export interface EmptyPayload {
  [key: string]: never;
}

export interface ErrorPayload<TCode extends string = string> {
  code: TCode;
  message: string;
}

export interface SessionHelloPayload {
  sessionToken?: string;
  nickname?: string;
}

export interface RoomJoinPayload {
  code: string;
}

export interface RoomSetReadyPayload {
  ready: boolean;
}

export interface RoomChatSendPayload {
  text: string;
}

export interface MatchStartedPayload {
  matchId: string;
  startsAt: number;
}

export interface MatchMovePayload {
  targetZoneId: string;
}

export interface MoveRejectedPayload {
  reason: MoveRejectReason;
  targetZoneId: string;
}

export interface AbilityUsePayload {
  targetKind: AbilityTargetKind;
  targetId: string;
}

/** Broadcast to the whole match. Deliberately omits playerId (P19: "without naming who"). */
export interface AbilityUsedPayload {
  element: ElementId;
  zoneId: string;
}

export interface AbilityRejectedPayload {
  reason: AbilityRejectReason;
  targetKind: AbilityTargetKind;
  targetId: string;
}

export interface BugReportAckPayload {
  id: string;
  submittedAt: number;
}

// --- Match chat (P25-P28) ---

export interface MatchChatSendPayload {
  channel: Extract<ChatChannel, "global" | "team">;
  text: string;
}

export interface MatchChatHistoryPayload {
  channel: ChatChannel;
  /** Present when this history is for one specific private/traitor thread. */
  otherPlayerId?: string;
  messages: MatchChatMessageDTO[];
}

export interface MatchChatRejectedPayload {
  reason: ChatRejectReason;
}

// --- Private chat, signaling, and the traitor channel (P27, P32-P33) ---

export interface PrivateChatOpenPayload {
  targetPlayerId: string;
}

export interface PrivateChatOpenedPayload {
  otherPlayerId: string;
  otherNickname: string;
}

export interface PrivateChatSendPayload {
  targetPlayerId: string;
  text: string;
}

export interface PrivateChatSignalPayload {
  targetPlayerId: string;
}

export interface TraitorChatSendPayload {
  targetPlayerId: string;
  text: string;
}

// --- The secret key (P31-P32) ---

export interface KeyTransferPayload {
  targetPlayerId: string;
}

export interface KeyTransferRejectedPayload {
  reason: KeyTransferRejectReason;
  targetPlayerId: string;
}

// --- Moderation (P28) ---

export interface ModerationReportAckPayload {
  id: string;
}

/**
 * The authoritative map from message type -> payload shape. `MessageEnvelope`
 * itself stays loosely typed (matching the original P3 shape); use
 * `TypedMessage<"room:state">` etc. when you want the compiler to check a
 * specific message's payload.
 */
export interface MessagePayloadMap {
  ping: EmptyPayload;
  pong: EmptyPayload;

  "session:hello": SessionHelloPayload;
  "session:created": SessionInfoDTO;
  "session:resumed": SessionResumedDTO;
  "session:error": ErrorPayload<SessionErrorCode>;

  "room:create": EmptyPayload;
  "room:join": RoomJoinPayload;
  "room:setReady": RoomSetReadyPayload;
  "room:leave": EmptyPayload;
  "room:start": EmptyPayload;
  "room:state": RoomStateDTO;
  "room:error": ErrorPayload<RoomErrorCode>;

  "room:chat:send": RoomChatSendPayload;
  "room:chat:message": LobbyChatMessageDTO;
  "room:chat:history": LobbyChatMessageDTO[];

  "match:started": MatchStartedPayload;
  "match:snapshot": MatchSnapshotDTO;
  "match:move": MatchMovePayload;
  "match:moveRejected": MoveRejectedPayload;

  "ability:use": AbilityUsePayload;
  "ability:used": AbilityUsedPayload;
  "ability:rejected": AbilityRejectedPayload;

  "match:privateState": PrivateMatchStateDTO;

  "match:chat:send": MatchChatSendPayload;
  "match:chat:message": MatchChatMessageDTO;
  "match:chat:history": MatchChatHistoryPayload;
  "match:chat:rejected": MatchChatRejectedPayload;

  "privateChat:open": PrivateChatOpenPayload;
  "privateChat:opened": PrivateChatOpenedPayload;
  "privateChat:send": PrivateChatSendPayload;
  "privateChat:signal": PrivateChatSignalPayload;
  "traitorChat:send": TraitorChatSendPayload;

  "key:transfer": KeyTransferPayload;
  "key:transferRejected": KeyTransferRejectedPayload;

  "moderation:report": PlayerReportInput;
  "moderation:reportAck": ModerationReportAckPayload;

  "bugReport:submit": BugReportInput;
  "bugReport:ack": BugReportAckPayload;
  "bugReport:error": ErrorPayload;
}

export type TypedMessage<TType extends MessageType> = MessageEnvelope<
  MessagePayloadMap[TType]
> & { type: TType };
