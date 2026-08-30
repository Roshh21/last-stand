import type { MessageType } from "./types.js";

/**
 * The message envelope every WebSocket message uses, established in P3.
 * Deliberately unchanged in shape (type / payload / timestamp) - stronger
 * per-message typing is layered on top in payloads.ts rather than by
 * changing this interface.
 */
export interface MessageEnvelope<TPayload = unknown> {
  type: MessageType;
  payload: TPayload;
  timestamp: number;
}

export function createMessage<TPayload>(
  type: MessageType,
  payload: TPayload,
): MessageEnvelope<TPayload> {
  return { type, payload, timestamp: Date.now() };
}

/** Type guard for safely narrowing a value parsed from raw socket data. */
export function isMessageEnvelope(value: unknown): value is MessageEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.type === "string" &&
    typeof candidate.timestamp === "number" &&
    "payload" in candidate
  );
}
