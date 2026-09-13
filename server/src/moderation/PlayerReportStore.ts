import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { PlayerReportInput, PlayerReportRecord } from "@last-stand/shared";

const defaultFilePath = fileURLToPath(new URL("../../data/player-reports.jsonl", import.meta.url));

/**
 * P28: "a mute/report-player action reachable from chat." Mute is handled
 * entirely client-side (local filtering); reports are persisted here,
 * mirroring BugReportStore's append-only-JSONL approach exactly - same
 * reasoning applies (plenty for dev scale, revisit only if real volume
 * demands a proper datastore).
 */
export class PlayerReportStore {
  private readonly filePath: string;

  constructor(overrideFilePath?: string) {
    this.filePath = overrideFilePath ?? defaultFilePath;

    const dir = dirname(this.filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  save(
    input: PlayerReportInput,
    meta: Omit<PlayerReportRecord, keyof PlayerReportInput | "id">,
  ): PlayerReportRecord {
    const record: PlayerReportRecord = {
      id: randomUUID(),
      ...input,
      ...meta,
    };

    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, "utf-8");

    return record;
  }

  loadAll(): PlayerReportRecord[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    return readFileSync(this.filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as PlayerReportRecord);
  }
}
