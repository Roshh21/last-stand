/**
 * Bug report types (P9). Reports are free-form fields the player fills in;
 * the server attaches technical metadata automatically so nothing has to be
 * copy-pasted by hand.
 */

export interface BugReportInput {
  description: string;
  whatWasHappening: string;
  expectedResult: string;
  actualResult: string;
}

export interface BugReportRecord extends BugReportInput {
  id: string;
  playerId: string;
  nickname: string;
  matchId: string | null;
  roomCode: string | null;
  appVersion: string;
  userAgent: string;
  submittedAt: number;
}
