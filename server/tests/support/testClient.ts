import { WebSocket } from "ws";

import type { MessageEnvelope, MessageType } from "@last-stand/shared";

type Resolver = (message: MessageEnvelope) => void;

/**
 * Thin wrapper around a real `ws` client connection for integration tests:
 * send a typed message, and await the next message of a given type (or the
 * next one matching a predicate), with a timeout so a missing message fails
 * the test instead of hanging forever.
 */
export class TestClient {
  readonly messages: MessageEnvelope[] = [];
  private readonly waiters = new Map<MessageType, Resolver[]>();
  private readonly buffered = new Map<MessageType, MessageEnvelope[]>();

  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as MessageEnvelope;

      this.messages.push(message);

      const queue = this.waiters.get(message.type);

      if (queue && queue.length > 0) {
        const resolve = queue.shift()!;

        resolve(message);

        return;
      }

      // No one's waiting for this one yet - keep it so a waitFor() call
      // made slightly *after* this message arrived can still consume it.
      const bufferedQueue = this.buffered.get(message.type) ?? [];

      bufferedQueue.push(message);
      this.buffered.set(message.type, bufferedQueue);
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });

    return new TestClient(socket);
  }

  send<TPayload>(type: MessageType, payload: TPayload): void {
    this.socket.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }

  waitFor<TPayload = unknown>(type: MessageType, timeoutMs = 3000): Promise<MessageEnvelope<TPayload>> {
    const bufferedQueue = this.buffered.get(type);

    if (bufferedQueue && bufferedQueue.length > 0) {
      return Promise.resolve(bufferedQueue.shift() as MessageEnvelope<TPayload>);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for "${type}"`));
      }, timeoutMs);

      const queue = this.waiters.get(type) ?? [];

      queue.push((message) => {
        clearTimeout(timer);
        resolve(message as MessageEnvelope<TPayload>);
      });
      this.waiters.set(type, queue);
    });
  }

  async waitForMatching<TPayload = unknown>(
    type: MessageType,
    predicate: (payload: TPayload) => boolean,
    timeoutMs = 6000,
  ): Promise<MessageEnvelope<TPayload>> {
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        throw new Error(`Timed out waiting for a matching "${type}"`);
      }

      const message = await this.waitFor<TPayload>(type, remaining);

      if (predicate(message.payload)) {
        return message;
      }
    }
  }

  close(): void {
    this.socket.close();
  }

  closeAndWait(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.once("close", () => resolve());
      this.socket.close();
    });
  }
}
