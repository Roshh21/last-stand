const SESSION_TOKEN_KEY = "lastStand.sessionToken";
const NICKNAME_KEY = "lastStand.nickname";

/**
 * A real browser app (not a sandboxed artifact), so localStorage is the
 * right tool for "survive a refresh" (P7) - wrapped defensively in case
 * storage is unavailable (private browsing, etc).
 */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore - worst case, the next refresh just starts a new session.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

export function getStoredSessionToken(): string | null {
  return safeGet(SESSION_TOKEN_KEY);
}

export function setStoredSessionToken(token: string): void {
  safeSet(SESSION_TOKEN_KEY, token);
}

export function clearStoredSessionToken(): void {
  safeRemove(SESSION_TOKEN_KEY);
}

export function getStoredNickname(): string | null {
  return safeGet(NICKNAME_KEY);
}

export function setStoredNickname(nickname: string): void {
  safeSet(NICKNAME_KEY, nickname);
}
