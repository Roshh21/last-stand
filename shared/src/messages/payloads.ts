import type { BugReportInput } from "../bugReport.js";
import type { LobbyChatMessageDTO } from "../chat.js";
import type { MatchSnapshotDTO, MoveRejectReason } from "../match.js";
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

export interface BugReportAckPayload {
  id: string;
  submittedAt: number;
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

  "bugReport:submit": BugReportInput;
  "bugReport:ack": BugReportAckPayload;
  "bugReport:error": ErrorPayload;
}

export type TypedMessage<TType extends MessageType> = MessageEnvelope<
  MessagePayloadMap[TType]
> & { type: TType };
