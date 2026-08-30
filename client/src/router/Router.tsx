import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const ROUTES = {
  home: "/",
  games: "/games",
  island: "/games/island",
  friends: "/friends",
  profile: "/profile",
  settings: "/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

interface RouterContextValue {
  path: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

/**
 * A deliberately small router: real URL updates via the History API (so
 * back/forward/refresh behave normally), but no route params, nested
 * layouts, or data loaders - Island's own multiplayer state (which room,
 * which match) lives in GameClient, not the URL. Adding a routing library
 * for this would be more machinery than the app currently needs (P4: "keep
 * dependencies minimal").
 */
export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      path,
      navigate: (nextPath: string) => {
        if (nextPath === window.location.pathname) {
          return;
        }

        window.history.pushState({}, "", nextPath);
        setPath(nextPath);
      },
    }),
    [path],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);

  if (!ctx) {
    throw new Error("useRouter must be used within a RouterProvider");
  }

  return ctx;
}
