import type { BugReportStore } from "../bugReports/BugReportStore.js";
import type { MatchManager } from "../match/MatchManager.js";
import type { RoomManager } from "../rooms/RoomManager.js";
import type { SessionManager } from "../session/SessionManager.js";

export interface RouterContext {
  sessionManager: SessionManager;
  roomManager: RoomManager;
  matchManager: MatchManager;
  bugReportStore: BugReportStore;
}
