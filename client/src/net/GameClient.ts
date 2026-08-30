import {
  createMessage,
  isMessageEnvelope,
  type BugReportAckPayload,
  type BugReportInput,
  type ErrorPayload,
  type LobbyChatMessageDTO,
  type MatchSnapshotDTO,
  type MatchStartedPayload,
  type MessageEnvelope,
  type MessageType,
  type MoveRejectedPayload,
  type RoomErrorCode,
  type RoomStateDTO,
  type SessionErrorCode,
  type SessionInfoDTO,
  type SessionLocation,
  type SessionResumedDTO,
} from "@last-stand/shared";

import {
  clearStoredSessionToken,
  getStoredNickname,
  getStoredSessionToken,
  setStoredNickname,
  setStoredSessionToken,
} from "./storage.js";
import { resolveWsUrl } from "./wsUrl.js";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface ClientState {
  connectionStatus: ConnectionStatus;
  session: SessionInfoDTO | null;
  needsNickname: boolean;
  sessionError: ErrorPayload<SessionErrorCode> | null;

  room: RoomStateDTO | null;
  roomError: ErrorPayload<RoomErrorCode> | null;
  lobbyChat: LobbyChatMessageDTO[];

  match: MatchSnapshotDTO | null;
  lastMoveRejection: MoveRejectedPayload | null;

  bugReportStatus: "idle" | "sending" | "sent" | "error";
  bugReportError: string | null;

  /** Where the server says this session currently is; used to restore the right screen after a reconnect. */
  location: SessionLocation;
  /** Increments every time a session:resumed arrives, so a listener can react exactly once per resume. */
  resumeSequence: number;
}

function initialState(): ClientState {
  return {
    connectionStatus: "connecting",
    session: null,
    needsNickname: false,
    sessionError: null,
    room: null,
    roomError: null,
    lobbyChat: [],
    match: null,
    lastMoveRejection: null,
    bugReportStatus: "idle",
    bugReportError: null,
    location: { type: "none" },
    resumeSequence: 0,
  };
}

type Listener = () => void;

/**
 * Owns the single WebSocket connection and every bit of state derived from
 * it. Exposes a subscribe/getSnapshot pair so React can use it via
 * useSyncExternalStore without needing a separate state-management library.
 */
export class GameClient {
  private socket: WebSocket | null = null;
  private state: ClientState = initialState();
  private readonly listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ClientState => this.state;

  private setState(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };

    for (const listener of this.listeners) {
      listener();
    }
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setState({ connectionStatus: "connecting" });

    const socket = new WebSocket(resolveWsUrl());

    this.socket = socket;

    socket.addEventListener("open", () => {
      this.setState({ connectionStatus: "open" });
      this.sendHello();
    });

    socket.addEventListener("message", (event) => {
      this.handleRawMessage(event.data);
    });

    socket.addEventListener("close", () => {
      this.setState({ connectionStatus: "closed" });
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // "close" fires right after in browsers; no separate handling needed.
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.socket?.close();
    this.socket = null;
  }

  private sendHello(): void {
    const sessionToken = getStoredSessionToken() ?? undefined;
    const nickname = getStoredNickname() ?? undefined;

    this.rawSend("session:hello", { sessionToken, nickname });
  }

  /** Called by the nickname-entry UI (P7: "nickname entry step before joining a room"). */
  chooseNickname(nickname: string): void {
    setStoredNickname(nickname);
    this.setState({ needsNickname: false, sessionError: null });
    this.rawSend("session:hello", { nickname });
  }

  private rawSend<TPayload>(type: MessageType, payload: TPayload): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(createMessage(type, payload)));
  }

  private handleRawMessage(raw: unknown): void {
    if (typeof raw !== "string") {
      return;
    }

    let message: unknown;

    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isMessageEnvelope(message)) {
      return;
    }

    this.dispatch(message);
  }

  private dispatch(message: MessageEnvelope): void {
    switch (message.type) {
      case "pong":
        break;

      case "session:created": {
        const payload = message.payload as SessionInfoDTO;

        setStoredSessionToken(payload.sessionToken);
        setStoredNickname(payload.nickname);
        this.setState({ session: payload, sessionError: null, location: { type: "none" } });
        break;
      }

      case "session:resumed": {
        const payload = message.payload as SessionResumedDTO;

        setStoredSessionToken(payload.sessionToken);
        setStoredNickname(payload.nickname);
        this.setState({
          session: payload,
          sessionError: null,
          location: payload.location,
          resumeSequence: this.state.resumeSequence + 1,
        });
        break;
      }

      case "session:error": {
        const payload = message.payload as ErrorPayload<SessionErrorCode>;

        if (payload.code === "invalid_token") {
          clearStoredSessionToken();
        }

        this.setState({
          sessionError: payload,
          needsNickname: payload.code === "nickname_required" || payload.code === "nickname_invalid",
        });
        break;
      }

      case "room:state": {
        const payload = message.payload as RoomStateDTO;

        this.setState({
          room: payload,
          roomError: null,
          location: { type: "room", roomCode: payload.code },
        });
        break;
      }

      case "room:error":
        this.setState({ roomError: message.payload as ErrorPayload<RoomErrorCode> });
        break;

      case "room:chat:message": {
        const chatMessage = message.payload as LobbyChatMessageDTO;

        this.setState({ lobbyChat: [...this.state.lobbyChat, chatMessage].slice(-50) });
        break;
      }

      case "room:chat:history":
        this.setState({ lobbyChat: message.payload as LobbyChatMessageDTO[] });
        break;

      case "match:started": {
        const payload = message.payload as MatchStartedPayload;

        this.setState({
          location: { type: "match", matchId: payload.matchId, roomCode: this.state.room?.code ?? null },
          room: null,
          lobbyChat: [],
        });
        break;
      }

      case "match:snapshot":
        this.setState({ match: message.payload as MatchSnapshotDTO });
        break;

      case "match:moveRejected":
        this.setState({ lastMoveRejection: message.payload as MoveRejectedPayload });
        break;

      case "bugReport:ack":
        this.setState({ bugReportStatus: "sent", bugReportError: null });
        break;

      case "bugReport:error": {
        const payload = message.payload as ErrorPayload;

        this.setState({ bugReportStatus: "error", bugReportError: payload.message });
        break;
      }

      default:
        break;
    }
  }

  // --- Room actions (P5, P6) ---

  createRoom(): void {
    this.rawSend("room:create", {});
  }

  joinRoom(code: string): void {
    this.rawSend("room:join", { code });
  }

  setReady(ready: boolean): void {
    this.rawSend("room:setReady", { ready });
  }

  leaveRoom(): void {
    this.rawSend("room:leave", {});
    this.setState({ room: null, roomError: null, lobbyChat: [], location: { type: "none" } });
  }

  startGame(): void {
    this.rawSend("room:start", {});
  }

  sendChat(text: string): void {
    this.rawSend("room:chat:send", { text });
  }

  // --- Match actions (P13) ---

  move(targetZoneId: string): void {
    this.setState({ lastMoveRejection: null });
    this.rawSend("match:move", { targetZoneId });
  }

  // --- Bug reporting (P9) ---

  submitBugReport(input: BugReportInput): void {
    this.setState({ bugReportStatus: "sending", bugReportError: null });
    this.rawSend("bugReport:submit", input);
  }

  resetBugReportStatus(): void {
    this.setState({ bugReportStatus: "idle", bugReportError: null });
  }
}

export type { BugReportAckPayload };
