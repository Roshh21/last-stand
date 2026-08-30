import type { ReactNode } from "react";

import { BugReportWidget } from "../components/BugReportWidget.js";
import { ConnectionBadge } from "../components/ConnectionBadge.js";
import { useGameClient } from "../net/useGameClient.js";
import { ROUTES, useRouter } from "../router/Router.js";

const NAV_ITEMS = [
  { label: "Home", path: ROUTES.home },
  { label: "Games", path: ROUTES.games },
  { label: "Friends", path: ROUTES.friends },
  { label: "Profile", path: ROUTES.profile },
  { label: "Settings", path: ROUTES.settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { path, navigate } = useRouter();
  const state = useGameClient();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="brand">LAST STAND</span>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className="nav-link"
            data-active={path === item.path}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        <ConnectionBadge status={state.connectionStatus} />
      </nav>

      <main className="app-main">{children}</main>

      <BugReportWidget />
    </div>
  );
}
