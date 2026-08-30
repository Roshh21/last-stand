/**
 * Defaults to the server's dev port on the current hostname (matches the P3
 * scaffold's hardcoded "ws://localhost:3000"), but can be overridden via
 * VITE_WS_URL for anything other than local dev.
 */
export function resolveWsUrl(): string {
  const override = import.meta.env.VITE_WS_URL;

  if (override) {
    return override;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.hostname}:3000`;
}
