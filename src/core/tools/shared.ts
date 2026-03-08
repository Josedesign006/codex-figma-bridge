import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { extractFileKey, extractFigmaUrlInfo } from "../figma-api.js";
import { createChildLogger } from "../logger.js";
import type { ScreenshotResult, ServerConfig } from "../types/index.js";
import type { FigmaWebSocketServer } from "../websocket-server.js";
import type { FigmaAPI } from "../figma-api.js";
import type { IFigmaConnector } from "../figma-connector.js";

const logger = createChildLogger({ component: "tool-shared" });

export const fileTargetSchema = {
  fileUrl: z.string().url().optional().describe("Full Figma file URL"),
  fileKey: z.string().min(1).optional().describe("Raw Figma file key")
};

export const nodeTargetSchema = {
  nodeId: z.string().min(1).optional().describe("Figma node id, for example 1:2")
};

export function textResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export function resolveTarget(input: { fileUrl?: string; fileKey?: string; nodeId?: string }) {
  const fromUrl = input.fileUrl ? extractFigmaUrlInfo(input.fileUrl) : null;
  const fileKey = input.fileKey || fromUrl?.fileKey || (input.fileUrl ? extractFileKey(input.fileUrl) : null);
  const nodeId = input.nodeId || fromUrl?.nodeId;

  if (!fileKey) {
    throw new Error("Provide either fileUrl or fileKey.");
  }

  return {
    fileKey,
    branchId: fromUrl?.branchId,
    nodeId
  };
}

export interface ToolDependencies {
  config: ServerConfig;
  wsServer: FigmaWebSocketServer;
  getFigmaAPI: () => Promise<FigmaAPI>;
  getConnector: () => Promise<IFigmaConnector>;
  getCachedVariables: (fileKey: string) => unknown | null;
  setCachedVariables: (fileKey: string, data: unknown) => void;
}

export async function maybePersistScreenshot(
  config: ServerConfig,
  result: ScreenshotResult,
  options: {
    saveFile?: boolean;
  }
) {
  if (!options.saveFile || !result.base64) {
    return result;
  }

  const extension = result.format === "jpg" ? "jpg" : "png";
  const filename = `${result.nodeId.replace(/[:/]/g, "-")}-${Date.now()}.${extension}`;
  const destination = join(config.screenshotDir, filename);

  await writeFile(destination, Buffer.from(result.base64, "base64"));

  logger.info({ destination }, "Screenshot saved to disk");
  return {
    ...result,
    savedTo: destination,
    base64: undefined
  };
}
