import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { textResponse } from "./shared.js";
import type { ToolDependencies } from "./shared.js";

const layoutSchema = z
  .object({
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
    primaryAxisSizingMode: z.enum(["FIXED", "AUTO"]).optional(),
    counterAxisSizingMode: z.enum(["FIXED", "AUTO"]).optional(),
    primaryAxisAlignItems: z
      .enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"])
      .optional(),
    counterAxisAlignItems: z.enum(["MIN", "CENTER", "MAX", "BASELINE"]).optional(),
    itemSpacing: z.number().optional(),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional()
  })
  .strict();

export const executeSchema = {
  code: z.string().min(1).describe("Plugin-side code body to execute"),
  timeoutMs: z.number().int().min(100).max(60000).optional().default(5000)
};

export const createPageSchema = {
  name: z.string().min(1),
  switchToPage: z.boolean().optional().default(true)
};

export const createFrameSchema = {
  name: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  x: z.number().optional().default(0),
  y: z.number().optional().default(0),
  parentId: z.string().optional(),
  fills: z.array(z.unknown()).optional().default([]),
  layout: layoutSchema.optional()
};

export const createComponentSchema = {
  name: z.string().optional(),
  sourceNodeId: z.string().optional(),
  parentId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fills: z.array(z.unknown()).optional().default([]),
  description: z.string().optional(),
  layout: layoutSchema.optional()
};

export const tokenVariableSchema = z.object({
  name: z.string().min(1),
  resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]),
  value: z.unknown().optional(),
  valuesByMode: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  hiddenFromPublishing: z.boolean().optional()
});

export const createTokensSchema = {
  collectionName: z.string().min(1),
  modes: z.array(z.string().min(1)).optional(),
  variables: z.array(tokenVariableSchema).min(1),
  reuseCollectionByName: z.boolean().optional().default(true),
  reuseVariablesByName: z.boolean().optional().default(true)
};

export const batchOperationSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().optional()
  })
  .passthrough();

export const applyOperationsSchema = {
  operations: z.array(batchOperationSchema).min(1)
};

export const setTextSchema = {
  nodeId: z.string().min(1),
  text: z.string()
};

export const setFillsSchema = {
  nodeId: z.string().min(1),
  fills: z.array(z.unknown()).min(1)
};

export function registerWriteTools(server: McpServer, deps: ToolDependencies): void {
  server.tool(
    "figma_execute",
    "Execute constrained plugin-side code in the active Figma Desktop file.",
    executeSchema,
    async ({ code, timeoutMs }) => {
      const connector = await deps.getConnector();
      const result = await connector.executeCode(code, timeoutMs);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_create_page",
    "Create and optionally switch to a new page in the active Figma file.",
    createPageSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const result = await connector.createPage(input);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_create_frame",
    "Create a frame with optional fills and auto-layout settings.",
    createFrameSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const result = await connector.createFrame(input);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_create_component",
    "Create a component from an existing node or create a blank component shell.",
    createComponentSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const result = await connector.createComponent(input);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_create_tokens",
    "Create or update a variable collection and token variables in the active Figma file.",
    createTokensSchema,
    async (input) => {
      const connector = await deps.getConnector();
      const result = await connector.createTokens(input);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_apply_operations",
    "Apply a batch of frame, text, rectangle, component, page, layout, and token-adjacent operations in order.",
    applyOperationsSchema,
    async ({ operations }) => {
      const connector = await deps.getConnector();
      const result = await connector.applyOperations(
        operations as Array<Record<string, unknown>>
      );
      return textResponse(result);
    }
  );

  server.tool(
    "figma_set_text",
    "Update text content for a TEXT node by node id.",
    setTextSchema,
    async ({ nodeId, text }) => {
      const connector = await deps.getConnector();
      const result = await connector.setText(nodeId, text);
      return textResponse(result);
    }
  );

  server.tool(
    "figma_set_fills",
    "Update fills for a node by node id.",
    setFillsSchema,
    async ({ nodeId, fills }) => {
      const connector = await deps.getConnector();
      const result = await connector.setFills(nodeId, fills);
      return textResponse(result);
    }
  );
}
