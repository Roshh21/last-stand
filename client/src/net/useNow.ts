import { useEffect, useState } from "react";

/** A ticking clock as React state, so components never call Date.now() directly during render. */
export function useNow(intervalMs = 200): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);

    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
