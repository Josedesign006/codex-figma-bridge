import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatVariables } from "../figma-api.js";
import { normalizeDesignContext } from "../design-context.js";
import { createChildLogger } from "../logger.js";
import type { NormalizedDesignContext, ScreenshotResult } from "../types/index.js";
import { maybePersistScreenshot, fileTargetSchema, nodeTargetSchema, resolveTarget, textResponse } from "./shared.js";
import type { ToolDependencies } from "./shared.js";

const logger = createChildLogger({ component: "read-tools" });

export const getFileDataSchema = {
  ...fileTargetSchema,
  ...nodeTargetSchema,
  depth: z.number().int().min(1).max(8).optional().default(2)
};

export const getStylesSchema = {
  ...fileTargetSchema
};

export const getVariablesSchema = {
  ...fileTargetSchema,
  refreshCache: z.boolean().optional().default(false)
};

export const extractDesignSystemSchema = {
  pageNames: z.array(z.string().min(1)).optional(),
  includeComponents: z.boolean().optional().default(true),
  maxEntriesPerBucket: z.number().int().min(3).max(50).optional().default(12)
};

export const getSelectionSchema = {
  fileKey: z.string().optional()
};

export const takeScreenshotSchema = {
  nodeId: z.string().optional(),
  format: z.enum(["png", "jpg"]).optional().default("png"),
  scale: z.number().min(0.1).max(4).optional().default(1),
  includeBase64: z.boolean().optional().default(false),
  saveFile: z.boolean().optional().default(true)
};

export const getDesignContextSchema = {
  ...fileTargetSchema,
  ...nodeTargetSchema,
  includeVariables: z.boolean().optional().default(true),
  includeScreenshot: z.boolean().optional().default(true),
  saveScreenshotFile: z.boolean().optional().default(true)
};

async function loadVariables(deps: ToolDependencies, fileKey: string, refreshCache: boolean) {
  if (!refreshCache) {
    const cached = deps.getCachedVariables(fileKey);
    if (cached) {
      return { source: "plugin" as const, raw: cached };
    }
  }

  if (deps.wsServer.isClientConnected()) {
    try {
      const connector = await deps.getConnector();
      const pluginVariables = await connector.getVariables(fileKey);
      deps.setCachedVariables(fileKey, pluginVariables);
      return { source: "plugin" as const, raw: pluginVariables };
    } catch (error) {
      logger.warn({ fileKey, error }, "Plugin variable retrieval failed, falling back to REST");
    }
  }

  const api = await deps.getFigmaAPI();
  const restVariables = await api.getLocalVariables(fileKey);
  return { source: "rest" as const, raw: restVariables };
}

export function registerReadTools(server: McpServer, deps: ToolDependencies): void {
  server.tool(
    "figma_get_file_data",
    "Fetch trimmed Figma file metadata and optional node details from the REST API.",
    getFileDataSchema,
    async (input) => {
      const target = resolveTarget(input);
      const api = await deps.getFigmaAPI();
      const effectiveFileKey = await api.getBranchKey(target.fileKey, target.branchId);
      const fileData = await api.getFile(effectiveFileKey, {
        depth: input.depth,
        branch_data: true
      });
      const nodeData = target.nodeId
        ? await api.getNodes(effectiveFileKey, [target.nodeId], { depth: input.depth })
        : null;

      return textResponse({
        fileKey: effectiveFileKey,
        name: fileData.name,
        lastModified: fileData.lastModified,
        version: fileData.version,
        role: fileData.role,
        pages:
          fileData.document?.children?.map((page: Record<string, unknown>) => ({
            id: page.id,
            name: page.name,
            type: page.type
          })) ?? [],
        node: target.nodeId ? nodeData?.nodes?.[target.nodeId]?.document ?? null : null
      });
    }
  );

  server.tool(
    "figma_get_styles",
    "Fetch local styles from the Figma REST API for a file.",
    getStylesSchema,
    async (input) => {
      const target = resolveTarget(input);
      const api = await deps.getFigmaAPI();
      const effectiveFileKey = await api.getBranchKey(target.fileKey, target.branchId);
      const styles = await api.getStyles(effectiveFileKey);
      return textResponse({
        fileKey: effectiveFileKey,
        meta: styles.meta ?? styles
      });
    }
  );

  server.tool(
    "figma_get_variables",
    "Fetch local variables, preferring plugin-backed data when the bridge is connected.",
    getVariablesSchema,
    async (input) => {
      const target = resolveTarget(input);
      const api = await deps.getFigmaAPI();
      const effectiveFileKey = await api.getBranchKey(target.fileKey, target.branchId);
      const variablesResult = await loadVariables(deps, effectiveFileKey, input.refreshCache);

      return textResponse({
        fileKey: effectiveFileKey,
        source: variablesResult.source,
        ...formatVariables(variablesResult.raw)
      });
    }
  );

  server.tool(
    "figma_extract_design_system",
    "Analyze the connected Figma file across loaded pages and extract colors, spacing, radius, typography, and reusable components without relying on ad hoc execute snippets.",
    extractDesignSystemSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const analysis = await connector.analyzeDesignSystem({
        pageNames: input.pageNames,
        includeComponents: input.includeComponents,
        maxEntriesPerBucket: input.maxEntriesPerBucket
      });
      return textResponse(analysis);
    }
  );

  server.tool(
    "figma_get_selection",
    "Get the current selection from the active connected Figma Desktop file.",
    getSelectionSchema,
    async ({ fileKey }) => {
      const connector = await deps.getConnector();
      const selection = await connector.getSelection(fileKey);
      return textResponse({
        fileKey: deps.wsServer.getActiveFileKey(),
        selection
      });
    }
  );

  server.tool(
    "figma_take_screenshot",
    "Capture a node screenshot from Figma Desktop through the bridge plugin.",
    takeScreenshotSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const raw = (await connector.captureScreenshot(input.nodeId, {
        format: input.format,
        scale: input.scale,
        includeBase64: input.includeBase64 || input.saveFile
      })) as ScreenshotResult;
      const persisted = await maybePersistScreenshot(deps.config, raw, {
        saveFile: input.saveFile
      });
      return textResponse(persisted);
    }
  );

  server.tool(
    "figma_get_design_context",
    "Return normalized design context for a file/node, merging REST metadata with plugin-backed variables and screenshots when available.",
    getDesignContextSchema,
    async (input) => {
      const target = resolveTarget(input);
      const api = await deps.getFigmaAPI();
      const effectiveFileKey = await api.getBranchKey(target.fileKey, target.branchId);
      const fileData = await api.getFile(effectiveFileKey, {
        depth: 2,
        branch_data: true
      });
      const nodeResponse = target.nodeId
        ? await api.getNodes(effectiveFileKey, [target.nodeId], { depth: 2 })
        : null;
      const node = target.nodeId ? nodeResponse?.nodes?.[target.nodeId]?.document ?? null : null;

      const variables =
        input.includeVariables
          ? await loadVariables(deps, effectiveFileKey, false)
          : { source: "none" as const, raw: { variableCollections: {}, variables: {} } };

      let screenshot: NormalizedDesignContext["screenshot"] = null;
      let screenshotSource: "plugin" | "rest" | "none" = "none";

      if (input.includeScreenshot && target.nodeId) {
        if (deps.wsServer.isClientConnected()) {
          try {
            const connector = await deps.getConnector();
            const raw = (await connector.captureScreenshot(target.nodeId, {
              format: "png",
              scale: 1,
              includeBase64: input.saveScreenshotFile
            })) as ScreenshotResult;
            const persisted = await maybePersistScreenshot(deps.config, raw, {
              saveFile: input.saveScreenshotFile
            });
            screenshot = {
              nodeId: persisted.nodeId,
              format: persisted.format,
              mimeType: persisted.mimeType,
              savedTo: persisted.savedTo
            };
            screenshotSource = "plugin";
          } catch (error) {
            logger.warn({ error, nodeId: target.nodeId }, "Plugin screenshot failed, falling back to REST image");
          }
        }

        if (!screenshot) {
          const imageResponse = await api.getImages(effectiveFileKey, target.nodeId, {
            format: "png",
            scale: 2
          });
          screenshot = {
            nodeId: target.nodeId,
            format: "png",
            mimeType: "image/png",
            imageUrl: imageResponse.images?.[target.nodeId] ?? null
          };
          screenshotSource = "rest";
        }
      }

      const normalized = normalizeDesignContext({
        fileKey: effectiveFileKey,
        fileData,
        nodeId: target.nodeId,
        node,
        connectedFile: deps.wsServer.getConnectedFileInfo(),
        variables: input.includeVariables
          ? {
              source: variables.source,
              ...formatVariables(variables.raw)
            }
          : {
              source: "none",
              collections: [],
              variables: []
            },
        screenshot,
        screenshotSource,
        variableSource: variables.source
      });

      return textResponse(normalized);
    }
  );
}
