import type { ConnectionStatus } from "../net/GameClient.js";

const LABELS: Record<ConnectionStatus, string> = {
  open: "Connected",
  connecting: "Connecting…",
  closed: "Disconnected",
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className="connection-badge">
      <span className="connection-dot" data-status={status} />
      {LABELS[status]}
    </span>
  );
}
