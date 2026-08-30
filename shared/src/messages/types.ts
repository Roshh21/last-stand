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
  // bug reporting (P9)
  | "bugReport:submit"
  | "bugReport:ack"
  | "bugReport:error";
