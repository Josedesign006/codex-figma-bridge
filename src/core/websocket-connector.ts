import { createChildLogger } from "./logger.js";
import type {
  AnalyzeDesignSystemInput,
  CreateComponentInput,
  CreateFrameInput,
  CreatePageInput,
  CreateTokensInput,
  IFigmaConnector
} from "./figma-connector.js";
import type { ScreenshotResult } from "./types/index.js";
import type { FigmaWebSocketServer, SelectionInfo } from "./websocket-server.js";

const logger = createChildLogger({ component: "websocket-connector" });

export class WebSocketConnector implements IFigmaConnector {
  constructor(private readonly wsServer: FigmaWebSocketServer) {}

  async initialize(): Promise<void> {
    if (!this.wsServer.isClientConnected()) {
      throw new Error(
        "No Figma Desktop Bridge connection is active. Open the plugin in Figma Desktop first."
      );
    }
    logger.debug("WebSocket connector ready");
  }

  async getSelection(fileKey?: string): Promise<SelectionInfo | null> {
    if (fileKey) {
      this.wsServer.setActiveFile(fileKey);
    }
    return this.wsServer.getCurrentSelection();
  }

  async getVariables(fileKey?: string): Promise<unknown> {
    return this.wsServer.sendCommand("GET_VARIABLES", {}, 20000, fileKey);
  }

  async analyzeDesignSystem(input?: AnalyzeDesignSystemInput): Promise<unknown> {
    return this.wsServer.sendCommand("ANALYZE_DESIGN_SYSTEM", input ?? {}, 60000);
  }

  async captureScreenshot(
    nodeId?: string,
    options?: { format?: "png" | "jpg"; scale?: number; includeBase64?: boolean }
  ): Promise<ScreenshotResult> {
    return this.wsServer.sendCommand(
      "CAPTURE_SCREENSHOT",
      {
        nodeId,
        format: options?.format ?? "png",
        scale: options?.scale ?? 1,
        includeBase64: options?.includeBase64 ?? false
      },
      30000
    ) as Promise<ScreenshotResult>;
  }

  async executeCode(code: string, timeoutMs = 5000): Promise<unknown> {
    return this.wsServer.sendCommand(
      "EXECUTE_CODE",
      {
        code,
        timeoutMs
      },
      timeoutMs + 2000
    );
  }

  async createFrame(input: CreateFrameInput): Promise<unknown> {
    return this.wsServer.sendCommand("CREATE_FRAME", input, 15000);
  }

  async createPage(input: CreatePageInput): Promise<unknown> {
    return this.wsServer.sendCommand("CREATE_PAGE", input, 15000);
  }

  async createComponent(input: CreateComponentInput): Promise<unknown> {
    return this.wsServer.sendCommand("CREATE_COMPONENT", input, 20000);
  }

  async createTokens(input: CreateTokensInput): Promise<unknown> {
    return this.wsServer.sendCommand("CREATE_TOKENS", input, 30000);
  }

  async applyOperations(operations: Array<Record<string, unknown>>): Promise<unknown> {
    return this.wsServer.sendCommand("APPLY_OPERATIONS", { operations }, 45000);
  }

  async setText(nodeId: string, text: string): Promise<unknown> {
    return this.wsServer.sendCommand("SET_TEXT", { nodeId, text }, 15000);
  }

  async setFills(nodeId: string, fills: unknown[]): Promise<unknown> {
    return this.wsServer.sendCommand("SET_FILLS", { nodeId, fills }, 15000);
  }
}
