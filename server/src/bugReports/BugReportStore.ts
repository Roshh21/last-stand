import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { BugReportInput, BugReportRecord } from "@last-stand/shared";

const defaultFilePath = fileURLToPath(new URL("../../data/bug-reports.jsonl", import.meta.url));

/**
 * Bug reports are stored as append-only newline-delimited JSON (P9: "a flat
 * JSON file... is enough"). Plenty for local development; revisit with a
 * real datastore only if/when reports need to be queried at volume.
 */
export class BugReportStore {
  private readonly filePath: string;

  constructor(overrideFilePath?: string) {
    this.filePath = overrideFilePath ?? defaultFilePath;

    const dir = dirname(this.filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  save(
    input: BugReportInput,
    meta: Omit<BugReportRecord, keyof BugReportInput | "id">,
  ): BugReportRecord {
    const record: BugReportRecord = {
      id: randomUUID(),
      ...input,
      ...meta,
    };

    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, "utf-8");

    return record;
  }

  loadAll(): BugReportRecord[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    return readFileSync(this.filePath, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as BugReportRecord);
  }
}
