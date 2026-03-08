import type { NormalizedDesignContext } from "./types/index.js";
import type { ConnectedFileInfo } from "./websocket-server.js";

function pickNodeBasics(node: Record<string, any> | null | undefined) {
  if (!node) {
    return null;
  }

  return {
    id: node.id ?? null,
    name: node.name,
    type: node.type,
    visible: node.visible,
    componentPropertyDefinitions: node.componentPropertyDefinitions,
    boundVariables: node.boundVariables ?? null,
    children: Array.isArray(node.children)
      ? node.children.slice(0, 20).map((child: Record<string, unknown>) => ({
          id: child.id as string | undefined,
          name: child.name as string | undefined,
          type: child.type as string | undefined
        }))
      : undefined
  };
}

export function normalizeDesignContext(input: {
  fileKey: string;
  fileData?: Record<string, any> | null;
  nodeId?: string;
  node?: Record<string, any> | null;
  variables?: {
    source: "plugin" | "rest" | "none";
    collections: unknown[];
    variables: unknown[];
    summary?: Record<string, unknown>;
  };
  screenshot?: {
    nodeId: string;
    mimeType: string;
    format: string;
    savedTo?: string;
    imageUrl?: string | null;
  } | null;
  connectedFile?: ConnectedFileInfo | null;
  screenshotSource?: "plugin" | "rest" | "none";
  variableSource?: "plugin" | "rest" | "none";
}): NormalizedDesignContext {
  const node = input.node ?? null;
  const fileData = input.fileData ?? null;
  const document = fileData?.document ?? {};
  const layout = node
    ? {
        absoluteBoundingBox: node.absoluteBoundingBox,
        size: {
          width: node.absoluteBoundingBox?.width,
          height: node.absoluteBoundingBox?.height
        },
        layoutMode: node.layoutMode,
        primaryAxisAlignItems: node.primaryAxisAlignItems,
        counterAxisAlignItems: node.counterAxisAlignItems,
        itemSpacing: node.itemSpacing,
        padding: {
          top: node.paddingTop,
          right: node.paddingRight,
          bottom: node.paddingBottom,
          left: node.paddingLeft
        },
        cornerRadius: node.cornerRadius,
        constraints: node.constraints
      }
    : null;

  const styles = node
    ? {
        fills: node.fills,
        strokes: node.strokes,
        effects: node.effects,
        strokeWeight: node.strokeWeight,
        opacity: node.opacity,
        styleIds: {
          fillStyleId: node.fillStyleId,
          strokeStyleId: node.strokeStyleId,
          effectStyleId: node.effectStyleId,
          textStyleId: node.textStyleId
        }
      }
    : null;

  const text = node
    ? {
        characters: node.characters,
        style: node.style,
        styleOverrideTable: node.styleOverrideTable
      }
    : null;

  return {
    file: {
      fileKey: input.fileKey,
      name: fileData?.name,
      lastModified: fileData?.lastModified,
      version: fileData?.version,
      role: fileData?.role,
      editorType: document.editorType,
      currentPage: input.connectedFile?.currentPage,
      currentPageId: input.connectedFile?.currentPageId
    },
    node: pickNodeBasics(node),
    layout,
    styles,
    text,
    variables:
      input.variables ?? {
        source: "none",
        collections: [],
        variables: []
      },
    screenshot: input.screenshot ?? null,
    source: {
      file: "rest",
      node: node ? "rest" : "none",
      screenshot: input.screenshotSource ?? "none",
      variables: input.variableSource ?? "none"
    }
  };
}
