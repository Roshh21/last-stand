import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

function readAppVersion(): string {
  try {
    const raw = readFileSync(packageJsonPath, "utf-8");
    const parsed = JSON.parse(raw) as { version?: string };

    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const PORT = Number(process.env.PORT ?? 3000);

/** Reported to clients and stamped on bug reports so reports are traceable to a build. */
export const APP_VERSION = readAppVersion();
