/**
 * Every WebSocket message type string, in one place. Adding a new message
 * kind means adding it here and to MessagePayloadMap in payloads.ts -
 * nowhere else should protocol strings be hand-typed.
 */
export type MessageType =
  // low-level connectivity check (P3)
  | "ping"
  | "pong"
  // session (P7)
  | "session:hello"
  | "session:created"
  | "session:resumed"
  | "session:error"
  // room / lobby (P5, P6)
  | "room:create"
  | "room:join"
  | "room:setReady"
  | "room:leave"
  | "room:start"
  | "room:state"
  | "room:error"
  // lobby chat placeholder (P6)
  | "room:chat:send"
  | "room:chat:message"
  | "room:chat:history"
  // match / game loop (P8) and movement (P13-P14)
  | "match:started"
  | "match:snapshot"
  | "match:move"
  | "match:moveRejected"
  // elemental abilities (P16-P19)
  | "ability:use"
  | "ability:used"
  | "ability:rejected"
  // private, per-player match state: role, key, private threads (P30-P33)
  | "match:privateState"
  // in-match chat: global, team, private, traitor (P25-P28, P32-P33)
  | "match:chat:send"
  | "match:chat:message"
  | "match:chat:history"
  | "match:chat:rejected"
  | "privateChat:open"
  | "privateChat:opened"
  | "privateChat:send"
  | "privateChat:signal"
  | "traitorChat:send"
  // the secret key (P31-P32)
  | "key:transfer"
  | "key:transferRejected"
  // moderation (P28)
  | "moderation:report"
  | "moderation:reportAck"
  // bug reporting (P9)
  | "bugReport:submit"
  | "bugReport:ack"
  | "bugReport:error";
