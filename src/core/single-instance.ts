import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { createChildLogger } from "./logger.js";

const logger = createChildLogger({ component: "single-instance" });

interface ProcessEntry {
  pid: number;
  command: string;
}

function listProcesses(): ProcessEntry[] {
  const output = execFileSync("ps", ["-Ao", "pid=,command="], {
    encoding: "utf8"
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      if (!match) {
        return null;
      }

      return {
        pid: Number.parseInt(match[1], 10),
        command: match[2]
      };
    })
    .filter((entry): entry is ProcessEntry => entry !== null);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForExit(pid: number, timeoutMs: number): boolean {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return true;
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }

  return !isProcessAlive(pid);
}

function normalizeScriptPaths(scriptPaths: string[]): string[] {
  const normalized = new Set<string>();
  for (const scriptPath of scriptPaths) {
    if (!scriptPath || !existsSync(scriptPath)) {
      continue;
    }

    try {
      normalized.add(realpathSync(scriptPath));
    } catch {
      // Ignore unreadable paths
    }
  }

  return Array.from(normalized);
}

export function cleanupBridgeProcesses(scriptPaths: string[]): number[] {
  const normalizedPaths = normalizeScriptPaths(scriptPaths);
  if (normalizedPaths.length === 0) {
    return [];
  }

  const duplicates = listProcesses().filter((entry) => {
    return (
      entry.pid !== process.pid &&
      normalizedPaths.some((resolvedScriptPath) => entry.command.includes(resolvedScriptPath))
    );
  });

  const terminated: number[] = [];
  for (const duplicate of duplicates) {
    try {
      process.kill(duplicate.pid, "SIGTERM");
      const exited = waitForExit(duplicate.pid, 1500);
      if (!exited) {
        process.kill(duplicate.pid, "SIGKILL");
        waitForExit(duplicate.pid, 500);
      }
      terminated.push(duplicate.pid);
    } catch (error) {
      logger.warn(
        { pid: duplicate.pid, command: duplicate.command, error },
        "Failed to terminate duplicate bridge process"
      );
    }
  }

  if (terminated.length > 0) {
    logger.info({ terminated, normalizedPaths }, "Terminated duplicate bridge processes");
  }

  return terminated;
}

export function cleanupDuplicateBridgeProcesses(scriptPath: string = process.argv[1] || ""): number[] {
  return cleanupBridgeProcesses(scriptPath ? [scriptPath] : []);
}
