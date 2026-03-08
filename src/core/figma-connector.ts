import type { ScreenshotResult } from "./types/index.js";
import type { SelectionInfo } from "./websocket-server.js";

export interface CreateFrameInput {
  name?: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  parentId?: string;
  fills?: unknown[];
}

export interface CreatePageInput {
  name: string;
  switchToPage?: boolean;
}

export interface CreateComponentInput {
  name?: string;
  sourceNodeId?: string;
  parentId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: unknown[];
  description?: string;
  layout?: Record<string, unknown>;
}

export interface CreateTokensInput {
  collectionName: string;
  modes?: string[];
  variables: Array<{
    name: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    value?: unknown;
    valuesByMode?: Record<string, unknown>;
    description?: string;
    scopes?: string[];
    hiddenFromPublishing?: boolean;
  }>;
  reuseCollectionByName?: boolean;
  reuseVariablesByName?: boolean;
}

export interface AnalyzeDesignSystemInput {
  pageNames?: string[];
  includeComponents?: boolean;
  maxEntriesPerBucket?: number;
}

export interface IFigmaConnector {
  initialize(): Promise<void>;
  getSelection(fileKey?: string): Promise<SelectionInfo | null>;
  getVariables(fileKey?: string): Promise<unknown>;
  analyzeDesignSystem(input?: AnalyzeDesignSystemInput): Promise<unknown>;
  captureScreenshot(
    nodeId?: string,
    options?: { format?: "png" | "jpg"; scale?: number; includeBase64?: boolean }
  ): Promise<ScreenshotResult>;
  executeCode(code: string, timeoutMs?: number): Promise<unknown>;
  createFrame(input: CreateFrameInput): Promise<unknown>;
  createPage(input: CreatePageInput): Promise<unknown>;
  createComponent(input: CreateComponentInput): Promise<unknown>;
  createTokens(input: CreateTokensInput): Promise<unknown>;
  applyOperations(operations: Array<Record<string, unknown>>): Promise<unknown>;
  setText(nodeId: string, text: string): Promise<unknown>;
  setFills(nodeId: string, fills: unknown[]): Promise<unknown>;
}
