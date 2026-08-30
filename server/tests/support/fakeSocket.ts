/**
 * A minimal stand-in for a `ws` WebSocket, just enough to satisfy
 * SessionManager.send()'s readyState check and capture what was sent.
 * Cast to WebSocket at the call site - this is test-only.
 */
export class FakeSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 1;
  readonly sent: Array<{ type: string; payload: unknown }> = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = 3;
  }
}
