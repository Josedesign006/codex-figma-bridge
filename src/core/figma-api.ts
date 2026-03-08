import { createChildLogger } from "./logger.js";

const logger = createChildLogger({ component: "figma-api" });
const FIGMA_API_BASE = "https://api.figma.com/v1";

export interface FigmaAPIConfig {
  accessToken: string;
}

export interface FigmaUrlInfo {
  fileKey: string;
  branchId?: string;
  nodeId?: string;
}

export function extractFileKey(url: string): string | null {
  try {
    const match = new URL(url).pathname.match(/\/(design|file)\/([a-zA-Z0-9]+)/);
    return match ? match[2] : null;
  } catch {
    return null;
  }
}

export function extractFigmaUrlInfo(url: string): FigmaUrlInfo | null {
  try {
    const urlObject = new URL(url);
    const branchMatch = urlObject.pathname.match(
      /\/(design|file)\/([a-zA-Z0-9]+)\/branch\/([a-zA-Z0-9]+)/
    );
    if (branchMatch) {
      return {
        fileKey: branchMatch[2],
        branchId: branchMatch[3],
        nodeId: urlObject.searchParams.get("node-id")?.replace(/-/g, ":")
      };
    }

    const match = urlObject.pathname.match(/\/(design|file)\/([a-zA-Z0-9]+)/);
    if (!match) {
      return null;
    }

    return {
      fileKey: match[2],
      branchId: urlObject.searchParams.get("branch-id") || undefined,
      nodeId: urlObject.searchParams.get("node-id")?.replace(/-/g, ":")
    };
  } catch {
    return null;
  }
}

export class FigmaAPI {
  constructor(private readonly config: FigmaAPIConfig) {}

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const isOAuthToken = this.config.accessToken.startsWith("figu_");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined)
    };

    if (isOAuthToken) {
      headers.Authorization = `Bearer ${this.config.accessToken}`;
    } else {
      headers["X-Figma-Token"] = this.config.accessToken;
    }

    const response = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Figma API error (${response.status}): ${body}`);
    }

    return response.json();
  }

  /**
   * GET /v1/files/:file_key
   * Get full file data including document tree, components, and styles
   */
  async getFile(fileKey: string, options?: {
    version?: string;
    ids?: string[];
    depth?: number;
    geometry?: 'paths' | 'screen';
    plugin_data?: string;
    branch_data?: boolean;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.version) params.append('version', options.version);
    if (options?.ids) params.append('ids', options.ids.join(','));
    if (options?.depth !== undefined) params.append('depth', options.depth.toString());
    if (options?.geometry) params.append('geometry', options.geometry);
    if (options?.plugin_data) params.append('plugin_data', options.plugin_data);
    if (options?.branch_data) params.append('branch_data', 'true');

    const query = params.toString();
    return this.request(`/files/${fileKey}${query ? `?${query}` : ""}`);
  }

  /**
   * Resolve a branch key from a branch ID
   * If branchId is provided, fetches branch data and returns the branch's unique key
   * Otherwise returns the main file key unchanged
   * @param fileKey The main file key from the URL
   * @param branchId Optional branch ID from URL query param (branch-id)
   * @returns The effective file key to use for API calls (branch key if on branch, otherwise fileKey)
   */
  async getBranchKey(fileKey: string, branchId?: string): Promise<string> {
    if (!branchId) {
      return fileKey;
    }

    try {
      const fileData = await this.getFile(fileKey, { branch_data: true });
      const branches = fileData.branches || [];

      // Try to find branch by key (branchId might already be the key)
      // or by matching other identifiers
      const branch = branches.find((b: { key?: string; name?: string }) =>
        b.key === branchId || b.name === branchId
      );

      if (branch?.key) {
        return branch.key;
      }

      // If branchId looks like a file key (alphanumeric), it might already be the branch key
      // In this case, return it directly as it may be usable
      if (/^[a-zA-Z0-9]+$/.test(branchId)) {
        return branchId;
      }
      return fileKey;
    } catch (error) {
      logger.warn({ error, fileKey, branchId }, "Failed to resolve branch key, falling back to main file");
      return fileKey;
    }
  }

  /**
   * GET /v1/files/:file_key/variables/local
   * Get local variables (design tokens) from a file
   */
  async getLocalVariables(fileKey: string): Promise<any> {
    const response = await this.request(`/files/${fileKey}/variables/local`);
    // Figma API returns {status, error, meta: {variableCollections, variables}}
    // Extract meta to match expected format
    return response.meta || response;
  }

  /**
   * GET /v1/files/:file_key/variables/published
   * Get published variables from a file
   */
  async getPublishedVariables(fileKey: string): Promise<any> {
    const response = await this.request(`/files/${fileKey}/variables/published`);
    // Figma API returns {status, error, meta: {variableCollections, variables}}
    // Extract meta to match expected format
    return response.meta || response;
  }

  /**
   * GET /v1/files/:file_key/nodes
   * Get specific nodes by ID
   */
  async getNodes(fileKey: string, nodeIds: string[], options?: {
    version?: string;
    depth?: number;
    geometry?: 'paths' | 'screen';
    plugin_data?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    params.append('ids', nodeIds.join(','));
    if (options?.version) params.append('version', options.version);
    if (options?.depth !== undefined) params.append('depth', options.depth.toString());
    if (options?.geometry) params.append('geometry', options.geometry);
    if (options?.plugin_data) params.append('plugin_data', options.plugin_data);

    return this.request(`/files/${fileKey}/nodes?${params.toString()}`);
  }

  /**
   * GET /v1/files/:file_key/styles
   * Get styles from a file
   */
  async getStyles(fileKey: string): Promise<any> {
    return this.request(`/files/${fileKey}/styles`);
  }

  /**
   * GET /v1/files/:file_key/components
   * Get components from a file
   */
  async getComponents(fileKey: string): Promise<any> {
    return this.request(`/files/${fileKey}/components`);
  }

  /**
   * GET /v1/files/:file_key/component_sets
   * Get component sets (variants) from a file
   */
  async getComponentSets(fileKey: string): Promise<any> {
    return this.request(`/files/${fileKey}/component_sets`);
  }

	/**
	 * GET /v1/images/:file_key
	 * Renders images for specified nodes
	 * @param fileKey - The file key
	 * @param nodeIds - Node IDs to render (single string or array)
	 * @param options - Rendering options
	 * @returns Map of node IDs to image URLs (URLs expire after 30 days)
	 */
	async getImages(
		fileKey: string,
		nodeIds: string | string[],
		options?: {
			scale?: number; // 0.01-4, default 1
			format?: 'png' | 'jpg' | 'svg' | 'pdf'; // default png
			svg_outline_text?: boolean; // default true
			svg_include_id?: boolean; // default false
			svg_include_node_id?: boolean; // default false
			svg_simplify_stroke?: boolean; // default true
			contents_only?: boolean; // default true
		}
	): Promise<{ images: Record<string, string | null> }> {
		const params = new URLSearchParams();

		// Handle single or multiple node IDs
		const ids = Array.isArray(nodeIds) ? nodeIds.join(',') : nodeIds;
		params.append('ids', ids);

		// Add optional parameters
		if (options?.scale !== undefined) params.append('scale', options.scale.toString());
		if (options?.format) params.append('format', options.format);
		if (options?.svg_outline_text !== undefined)
			params.append('svg_outline_text', options.svg_outline_text.toString());
		if (options?.svg_include_id !== undefined)
			params.append('svg_include_id', options.svg_include_id.toString());
		if (options?.svg_include_node_id !== undefined)
			params.append('svg_include_node_id', options.svg_include_node_id.toString());
		if (options?.svg_simplify_stroke !== undefined)
			params.append('svg_simplify_stroke', options.svg_simplify_stroke.toString());
		if (options?.contents_only !== undefined)
			params.append('contents_only', options.contents_only.toString());

		const endpoint = `/images/${fileKey}?${params.toString()}`;

		return this.request(endpoint);
	}

}

/**
 * Helper function to format variables for display
 */
export function formatVariables(variablesData: any): {
  collections: any[];
  variables: any[];
  summary: {
    totalCollections: number;
    totalVariables: number;
    variablesByType: Record<string, number>;
  };
} {
  const collections = Object.entries(variablesData.variableCollections || {}).map(
    ([id, collection]: [string, any]) => ({
      id,
      name: collection.name,
      key: collection.key,
      modes: collection.modes,
      variableIds: collection.variableIds,
    })
  );

  const variables = Object.entries(variablesData.variables || {}).map(
    ([id, variable]: [string, any]) => ({
      id,
      name: variable.name,
      key: variable.key,
      resolvedType: variable.resolvedType,
      valuesByMode: variable.valuesByMode,
      variableCollectionId: variable.variableCollectionId,
      scopes: variable.scopes,
      description: variable.description,
    })
  );

  const variablesByType = variables.reduce((acc, v) => {
    acc[v.resolvedType] = (acc[v.resolvedType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    collections,
    variables,
    summary: {
      totalCollections: collections.length,
      totalVariables: variables.length,
      variablesByType,
    },
  };
}

/**
 * Helper function to format component data for display
 */
export function formatComponentData(componentNode: any): {
  id: string;
  name: string;
  type: string;
  description?: string;
  descriptionMarkdown?: string;
  properties?: any;
  children?: any[];
  bounds?: any;
  fills?: any[];
  strokes?: any[];
  effects?: any[];
} {
  return {
    id: componentNode.id,
    name: componentNode.name,
    type: componentNode.type,
    description: componentNode.description,
    descriptionMarkdown: componentNode.descriptionMarkdown,
    properties: componentNode.componentPropertyDefinitions,
    children: componentNode.children?.map((child: any) => ({
      id: child.id,
      name: child.name,
      type: child.type,
    })),
    bounds: componentNode.absoluteBoundingBox,
    fills: componentNode.fills,
    strokes: componentNode.strokes,
    effects: componentNode.effects,
  };
}
