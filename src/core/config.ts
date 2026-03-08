import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LogLevel, ServerConfig } from "./types/index.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.toLowerCase();
  if (
    normalized === "trace" ||
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error" ||
    normalized === "fatal"
  ) {
    return normalized;
  }
  return "info";
}

export function getConfig(): ServerConfig {
  const screenshotDir =
    process.env.FIGMA_SCREENSHOT_DIR ||
    join(tmpdir(), "codex-figma-bridge", "screenshots");

  mkdirSync(screenshotDir, { recursive: true });

  return {
    mode: "local",
    wsHost: process.env.FIGMA_WS_HOST || "localhost",
    wsPort: parsePositiveInt(process.env.FIGMA_WS_PORT, 9223),
    wsPortRange: parsePositiveInt(process.env.FIGMA_WS_PORT_RANGE, 10),
    requestTimeoutMs: parsePositiveInt(process.env.FIGMA_REQUEST_TIMEOUT_MS, 15000),
    variableCacheTtlMs: parsePositiveInt(process.env.FIGMA_VARIABLE_CACHE_TTL_MS, 300000),
    screenshotDir,
    logLevel: parseLogLevel(process.env.LOG_LEVEL)
  };
}
