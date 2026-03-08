export type ConsoleLogLevel = "log" | "info" | "warn" | "error" | "debug";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface ConsoleLogEntry {
  timestamp: number;
  level: ConsoleLogLevel;
  message: string;
  args?: unknown[];
  stackTrace?: string;
  source?: string;
}

export interface ServerConfig {
  mode: "local";
  wsHost: string;
  wsPort: number;
  wsPortRange: number;
  requestTimeoutMs: number;
  variableCacheTtlMs: number;
  screenshotDir: string;
  logLevel: LogLevel;
}

export interface FigmaConnectionStatus {
  mode: "local";
  wsPreferredPort: number;
  wsActualPort: number | null;
  bridgeName?: string;
  pluginManifestPath?: string;
  pluginConnected: boolean;
  pluginCapabilities?: string[];
  activeFile: {
    fileKey: string | null;
    fileName: string;
    currentPage?: string;
    currentPageId?: string;
    connectedAt: number;
    bridgeVariant?: string;
    pluginVersion?: string;
    supportedCommands?: string[];
  } | null;
  connectedFiles: Array<{
    fileKey: string | null;
    fileName: string;
    currentPage?: string;
    currentPageId?: string;
    connectedAt: number;
    isActive: boolean;
    bridgeVariant?: string;
    pluginVersion?: string;
    supportedCommands?: string[];
  }>;
  setupInstructions: string[];
}

export interface DesignContextRequest {
  fileUrl?: string;
  fileKey?: string;
  nodeId?: string;
  includeVariables?: boolean;
  includeScreenshot?: boolean;
  saveScreenshotFile?: boolean;
}

export interface NormalizedDesignContext {
  file: {
    fileKey: string;
    name?: string;
    lastModified?: string;
    version?: string;
    role?: string;
    editorType?: string;
    currentPage?: string;
    currentPageId?: string;
  };
  node: {
    id: string | null;
    name?: string;
    type?: string;
    visible?: boolean;
    componentPropertyDefinitions?: Record<string, unknown>;
    boundVariables?: Record<string, unknown> | null;
    children?: Array<{ id?: string; name?: string; type?: string }>;
  } | null;
  layout: {
    absoluteBoundingBox?: unknown;
    size?: { width?: number; height?: number };
    layoutMode?: string;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
    itemSpacing?: number;
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    cornerRadius?: unknown;
    constraints?: unknown;
  } | null;
  styles: {
    fills?: unknown;
    strokes?: unknown;
    effects?: unknown;
    strokeWeight?: number;
    opacity?: number;
    styleIds?: {
      fillStyleId?: string;
      strokeStyleId?: string;
      effectStyleId?: string;
      textStyleId?: string;
    };
  } | null;
  text: {
    characters?: string;
    style?: unknown;
    styleOverrideTable?: unknown;
  } | null;
  variables: {
    source: "plugin" | "rest" | "none";
    collections: unknown[];
    variables: unknown[];
    summary?: Record<string, unknown>;
  };
  screenshot: {
    nodeId: string;
    mimeType: string;
    format: string;
    savedTo?: string;
    imageUrl?: string | null;
  } | null;
  source: {
    file: "rest";
    node: "rest" | "none";
    screenshot: "plugin" | "rest" | "none";
    variables: "plugin" | "rest" | "none";
  };
}

export interface ScreenshotResult {
  nodeId: string;
  format: "png" | "jpg";
  mimeType: string;
  bytes: number;
  base64?: string;
  savedTo?: string;
}
