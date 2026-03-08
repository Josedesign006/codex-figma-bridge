import { createChildLogger } from "./logger.js";
import { DEFAULT_WS_PORT, getPortRange } from "./port-discovery.js";
import { FigmaWebSocketServer } from "./websocket-server.js";

const logger = createChildLogger({ component: "server-bootstrap" });

export interface StartedBridgeServer {
  server: FigmaWebSocketServer;
  actualPort: number;
}

export async function startBridgeServer(
  preferredPort: number = DEFAULT_WS_PORT,
  host = "127.0.0.1"
): Promise<StartedBridgeServer> {
  let lastError: Error | null = null;

  for (const port of getPortRange(preferredPort)) {
    const server = new FigmaWebSocketServer({ host, port });
    try {
      await server.start();
      return { server, actualPort: server.address()?.port ?? port };
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      lastError = typedError;
      const code = (typedError as NodeJS.ErrnoException).code;
      if (code !== "EADDRINUSE") {
        throw typedError;
      }
      logger.warn({ port }, "WebSocket port already in use, trying next port");
    }
  }

  throw lastError ?? new Error("No available WebSocket ports in configured range");
}
