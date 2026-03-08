import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolDependencies } from "./shared.js";
import { textResponse } from "./shared.js";

export const getStatusSchema = {
  fileKey: z.string().optional().describe("Optional active file key to switch to before status reporting")
};

const pluginCapabilities = [
  "figma_create_page",
  "figma_create_frame",
  "figma_create_component",
  "figma_create_tokens",
  "figma_apply_operations",
  "figma_set_text",
  "figma_set_fills",
  "figma_take_screenshot",
  "figma_get_variables",
  "figma_extract_design_system",
  "figma_get_selection"
];

export function registerStatusTools(server: McpServer, deps: ToolDependencies): void {
  server.tool(
    "figma_get_status",
    "Check bridge health, plugin connectivity, capabilities, active file details, and minimal setup guidance.",
    getStatusSchema,
    async ({ fileKey }) => {
      if (fileKey) {
        deps.wsServer.setActiveFile(fileKey);
      }

      const pluginConnected = deps.wsServer.isClientConnected();
      const setupInstructions = pluginConnected
        ? []
        : [
            "Start the bridge locally.",
            "Import figma-plugin/manifest.json as a Development plugin.",
            "Run the Codex Figma Bridge plugin in the target file and keep the plugin window open.",
            `The plugin scans ws://localhost:${deps.config.wsPort}-${deps.config.wsPort + deps.config.wsPortRange - 1}.`
          ];

      return textResponse({
        mode: "local",
        bridgeName: "Codex Figma Bridge",
        pluginManifestPath: "figma-plugin/manifest.json",
        wsPreferredPort: deps.config.wsPort,
        wsActualPort: deps.wsServer.address()?.port ?? null,
        pluginConnected,
        pluginCapabilities,
        activeFile: deps.wsServer.getConnectedFileInfo(),
        connectedFiles: deps.wsServer.getConnectedFiles(),
        setupInstructions
      });
    }
  );
}
