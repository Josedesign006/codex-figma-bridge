#!/usr/bin/env node

if (!process.env.FIGMA_WS_PORT) {
  process.env.FIGMA_WS_PORT = "9233";
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./core/config.js";
import { FigmaAPI } from "./core/figma-api.js";
import type { IFigmaConnector } from "./core/figma-connector.js";
import { createChildLogger } from "./core/logger.js";
import {
  advertisePort,
  cleanupStalePortFiles,
  registerPortCleanup,
  unadvertisePort
} from "./core/port-discovery.js";
import { startBridgeServer } from "./core/server-bootstrap.js";
import { registerReadTools } from "./core/tools/read-tools.js";
import { registerStatusTools } from "./core/tools/status-tools.js";
import { registerWriteTools } from "./core/tools/write-tools.js";
import { WebSocketConnector } from "./core/websocket-connector.js";
import type { FigmaWebSocketServer } from "./core/websocket-server.js";

const logger = createChildLogger({ component: "local-server" });

class LocalCodexFigmaBridge {
  private readonly config = getConfig();
  private readonly server: McpServer;
  private wsServer: FigmaWebSocketServer | null = null;
  private wsActualPort: number | null = null;
  private connector: IFigmaConnector | null = null;
  private figmaAPI: FigmaAPI | null = null;
  private readonly variableCache = new Map<string, { timestamp: number; data: unknown }>();

  constructor() {
    this.server = new McpServer(
      {
        name: "Codex Figma Bridge",
        version: "0.3.0"
      },
      {
        instructions: [
          "This MCP server bridges Codex to Figma Desktop through a local WebSocket plugin bridge.",
          "Use figma_get_status first if bridge state is unclear.",
          "Use figma_get_design_context for node-centric design-to-code tasks.",
          "Write tools require the Figma Desktop plugin to be running in the target file.",
          "This server supports typed creation flows for pages, frames, components, tokens, ordered batch operations, and FigJam-safe batch primitives."
        ].join("\n")
      }
    );
  }

  private async getFigmaAPI(): Promise<FigmaAPI> {
    if (!this.figmaAPI) {
      const token = process.env.FIGMA_ACCESS_TOKEN;
      if (!token) {
        throw new Error(
          "FIGMA_ACCESS_TOKEN is not configured. Set a personal access token in the environment."
        );
      }
      this.figmaAPI = new FigmaAPI({ accessToken: token });
    }

    return this.figmaAPI;
  }

  private async getConnector(): Promise<IFigmaConnector> {
    if (!this.wsServer?.isClientConnected()) {
      throw new Error(
        "Figma Desktop Bridge is not connected. Run the plugin in Figma Desktop and retry."
      );
    }

    if (!this.connector) {
      this.connector = new WebSocketConnector(this.wsServer);
    }

    await this.connector.initialize();
    return this.connector;
  }

  private getCachedVariables(fileKey: string): unknown | null {
    const cached = this.variableCache.get(fileKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.config.variableCacheTtlMs) {
      this.variableCache.delete(fileKey);
      return null;
    }

    return cached.data;
  }

  private setCachedVariables(fileKey: string, data: unknown): void {
    this.variableCache.set(fileKey, {
      timestamp: Date.now(),
      data
    });
  }

  private async startWebSocketBridge(): Promise<void> {
    const started = await startBridgeServer(this.config.wsPort, this.config.wsHost);
    this.wsServer = started.server;
    this.wsActualPort = started.actualPort;
    advertisePort(started.actualPort, this.config.wsHost);
    registerPortCleanup(started.actualPort);

    this.wsServer.on("fileConnected", ({ fileKey }) => {
      if (fileKey) {
        this.variableCache.delete(fileKey);
      }
    });

    this.wsServer.on("fileDisconnected", ({ fileKey }) => {
      if (fileKey) {
        this.variableCache.delete(fileKey);
      }
    });
  }

  private registerTools(): void {
    if (!this.wsServer) {
      throw new Error("WebSocket bridge has not been started");
    }

    const deps = {
      config: this.config,
      wsServer: this.wsServer,
      getFigmaAPI: () => this.getFigmaAPI(),
      getConnector: () => this.getConnector(),
      getCachedVariables: (fileKey: string) => this.getCachedVariables(fileKey),
      setCachedVariables: (fileKey: string, data: unknown) => this.setCachedVariables(fileKey, data)
    };

    registerStatusTools(this.server, deps);
    registerReadTools(this.server, deps);
    registerWriteTools(this.server, deps);
  }

  async start(): Promise<void> {
    cleanupStalePortFiles();
    await this.startWebSocketBridge();
    this.registerTools();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info(
      {
        wsPreferredPort: this.config.wsPort,
        wsActualPort: this.wsActualPort
      },
      "Codex Figma Bridge started"
    );
  }

  async stop(): Promise<void> {
    if (this.wsActualPort) {
      unadvertisePort(this.wsActualPort);
    }
    if (this.wsServer) {
      await this.wsServer.stop();
    }
  }
}

const bridge = new LocalCodexFigmaBridge();

bridge.start().catch(async (error) => {
  logger.error({ error }, "Failed to start Codex Figma Bridge");
  await bridge.stop().catch(() => undefined);
  process.exitCode = 1;
});

process.on("SIGINT", async () => {
  await bridge.stop().catch(() => undefined);
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await bridge.stop().catch(() => undefined);
  process.exit(0);
});
