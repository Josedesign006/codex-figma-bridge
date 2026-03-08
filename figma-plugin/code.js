figma.showUI(__html__, { width: 120, height: 44, visible: true, themeColors: true });

function post(type, payload) {
  var message = { type: type };
  if (payload) {
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        message[key] = payload[key];
      }
    }
  }
  figma.ui.postMessage(message);
}

function serializeNode(node) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parent ? node.parent.id : null,
    x: "x" in node ? node.x : undefined,
    y: "y" in node ? node.y : undefined,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined
  };
}

function getSelectionSnapshot() {
  var nodes = figma.currentPage.selection.map(serializeNode);
  return {
    nodes: nodes,
    count: nodes.length,
    page: figma.currentPage.name,
    timestamp: Date.now()
  };
}

function getFileInfo() {
  return {
    fileName: figma.root.name,
    fileKey: figma.fileKey || null,
    currentPage: figma.currentPage ? figma.currentPage.name : undefined,
    currentPageId: figma.currentPage ? figma.currentPage.id : undefined,
    bridgeVariant: "latest",
    pluginVersion: "0.3.0",
    supportedCommands: [
      "GET_SELECTION",
      "GET_VARIABLES",
      "ANALYZE_DESIGN_SYSTEM",
      "CAPTURE_SCREENSHOT",
      "EXECUTE_CODE",
      "CREATE_PAGE",
      "CREATE_FRAME",
      "CREATE_COMPONENT",
      "CREATE_TOKENS",
      "APPLY_OPERATIONS",
      "SET_TEXT",
      "SET_FILLS"
    ]
  };
}

function variableCollectionMap(collections) {
  var map = {};
  for (var i = 0; i < collections.length; i++) {
    var collection = collections[i];
    map[collection.id] = {
      id: collection.id,
      name: collection.name,
      key: collection.key,
      modes: collection.modes,
      defaultModeId: collection.defaultModeId,
      variableIds: collection.variableIds
    };
  }
  return map;
}

function variableMap(variables) {
  var map = {};
  for (var i = 0; i < variables.length; i++) {
    var variable = variables[i];
    map[variable.id] = {
      id: variable.id,
      name: variable.name,
      key: variable.key,
      resolvedType: variable.resolvedType,
      valuesByMode: variable.valuesByMode,
      variableCollectionId: variable.variableCollectionId,
      scopes: variable.scopes,
      description: variable.description,
      hiddenFromPublishing: variable.hiddenFromPublishing
    };
  }
  return map;
}

async function getVariablesPayload() {
  var variables = await figma.variables.getLocalVariablesAsync();
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  return {
    timestamp: Date.now(),
    fileKey: figma.fileKey || null,
    variableCollections: variableCollectionMap(collections),
    variables: variableMap(variables)
  };
}

function colorToHex(color) {
  if (!color) {
    return null;
  }

  function toHex(channel) {
    return Math.round((channel || 0) * 255).toString(16).padStart(2, "0");
  }

  return "#" + toHex(color.r) + toHex(color.g) + toHex(color.b);
}

function incrementCount(map, key) {
  if (key === null || key === undefined) {
    return;
  }
  map[key] = (map[key] || 0) + 1;
}

function topEntries(map, limit) {
  return Object.entries(map)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, limit)
    .map(function(entry) {
      return { key: entry[0], count: entry[1] };
    });
}

function analyzeNode(node, stats, includeComponents) {
  incrementCount(stats.nodeTypes, node.type);

  if ("fills" in node && Array.isArray(node.fills)) {
    for (var i = 0; i < node.fills.length; i++) {
      var fill = node.fills[i];
      if (fill.type === "SOLID") {
        incrementCount(stats.fillColors, colorToHex(fill.color));
      }
    }
  }

  if ("strokes" in node && Array.isArray(node.strokes)) {
    for (var j = 0; j < node.strokes.length; j++) {
      var stroke = node.strokes[j];
      if (stroke.type === "SOLID") {
        incrementCount(stats.strokeColors, colorToHex(stroke.color));
      }
    }
  }

  if ("cornerRadius" in node && typeof node.cornerRadius === "number") {
    incrementCount(stats.radii, String(node.cornerRadius));
  }

  if ("itemSpacing" in node && typeof node.itemSpacing === "number") {
    incrementCount(stats.spacing, String(node.itemSpacing));
  }

  if ("paddingTop" in node && typeof node.paddingTop === "number") {
    incrementCount(stats.spacing, String(node.paddingTop));
    incrementCount(stats.spacing, String(node.paddingRight));
    incrementCount(stats.spacing, String(node.paddingBottom));
    incrementCount(stats.spacing, String(node.paddingLeft));
  }

  if (node.type === "TEXT") {
    if (typeof node.fontSize === "number") {
      incrementCount(stats.textSizes, String(node.fontSize));
    }
    if (Array.isArray(node.fills)) {
      for (var k = 0; k < node.fills.length; k++) {
        var textFill = node.fills[k];
        if (textFill.type === "SOLID") {
          incrementCount(stats.textColors, colorToHex(textFill.color));
        }
      }
    }
  }

  if (includeComponents && (node.type === "COMPONENT" || node.type === "COMPONENT_SET")) {
    stats.components.push({
      id: node.id,
      name: node.name,
      type: node.type,
      childCount: "children" in node && Array.isArray(node.children) ? node.children.length : 0
    });
  }
}

async function handleAnalyzeDesignSystem(message) {
  await figma.loadAllPagesAsync();

  var pageNameSet = Array.isArray(message.pageNames) && message.pageNames.length > 0
    ? new Set(message.pageNames)
    : null;
  var includeComponents = message.includeComponents !== false;
  var maxEntries = message.maxEntriesPerBucket || 12;

  var pages = figma.root.children.filter(function(page) {
    return !pageNameSet || pageNameSet.has(page.name);
  });

  var summary = [];
  for (var i = 0; i < pages.length; i++) {
    var page = pages[i];
    var stats = {
      nodeTypes: {},
      fillColors: {},
      strokeColors: {},
      textColors: {},
      textSizes: {},
      radii: {},
      spacing: {},
      components: []
    };
    var nodes = page.findAll();
    for (var j = 0; j < nodes.length; j++) {
      analyzeNode(nodes[j], stats, includeComponents);
    }
    summary.push({
      id: page.id,
      name: page.name,
      nodeCount: nodes.length,
      nodeTypes: topEntries(stats.nodeTypes, maxEntries),
      fillColors: topEntries(stats.fillColors, maxEntries),
      strokeColors: topEntries(stats.strokeColors, maxEntries),
      textColors: topEntries(stats.textColors, maxEntries),
      textSizes: topEntries(stats.textSizes, maxEntries),
      radii: topEntries(stats.radii, maxEntries),
      spacing: topEntries(stats.spacing, maxEntries),
      components: stats.components.slice(0, maxEntries)
    });
  }

  return {
    fileName: figma.root.name,
    fileKey: figma.fileKey || null,
    currentPage: figma.currentPage ? figma.currentPage.name : null,
    pageCount: pages.length,
    pages: summary
  };
}

function toBase64(bytes) {
  var binary = "";
  var chunkSize = 0x8000;
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function hexToPaint(hex, opacity) {
  var normalized = (hex || "").replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error("Hex colors must be in #RRGGBB format");
  }

  return {
    type: "SOLID",
    color: {
      r: parseInt(normalized.slice(0, 2), 16) / 255,
      g: parseInt(normalized.slice(2, 4), 16) / 255,
      b: parseInt(normalized.slice(4, 6), 16) / 255
    },
    opacity: opacity === undefined ? 1 : opacity
  };
}

function normalizeFills(fills) {
  if (!Array.isArray(fills)) {
    return [];
  }

  return fills.map(function(fill) {
    if (fill.type === "SOLID" && fill.color) {
      return fill;
    }
    if (fill.hex) {
      return hexToPaint(fill.hex, fill.opacity);
    }
    throw new Error("Each fill must provide either a SOLID paint or a hex value");
  });
}

async function findNode(nodeId) {
  var node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error("Node not found: " + nodeId);
  }
  return node;
}

function resolveAlias(value, createdNodes) {
  if (typeof value === "string" && value.charAt(0) === "$") {
    var resolved = createdNodes[value.slice(1)];
    if (!resolved) {
      throw new Error("Unknown operation reference: " + value);
    }
    return resolved;
  }
  return value;
}

function setNumericProp(node, key, value) {
  if (value !== undefined && key in node) {
    node[key] = value;
  }
}

function applyLayout(node, layout) {
  if (!layout || typeof layout !== "object") {
    return;
  }

  var keys = [
    "layoutMode",
    "primaryAxisSizingMode",
    "counterAxisSizingMode",
    "primaryAxisAlignItems",
    "counterAxisAlignItems",
    "itemSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft"
  ];

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (layout[key] !== undefined && key in node) {
      node[key] = layout[key];
    }
  }
}

function applyBasicGeometry(node, input) {
  if (!input) {
    return;
  }

  if ("resize" in node && input.width !== undefined && input.height !== undefined) {
    node.resize(input.width, input.height);
  }
  setNumericProp(node, "x", input.x);
  setNumericProp(node, "y", input.y);
  if (input.fills && "fills" in node) {
    node.fills = normalizeFills(input.fills);
  }
  if (input.cornerRadius !== undefined && "cornerRadius" in node) {
    node.cornerRadius = input.cornerRadius;
  }
  applyLayout(node, input.layout);
}

async function loadFontsForTextNode(node, requestedFont) {
  if (node.type !== "TEXT") {
    throw new Error("Target node is not a TEXT node");
  }

  if (requestedFont) {
    await figma.loadFontAsync(requestedFont);
    node.fontName = requestedFont;
    return;
  }

  if (node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
    return;
  }

  if (typeof node.getRangeAllFontNames === "function") {
    var fontNames = node.getRangeAllFontNames(0, node.characters.length);
    var seen = {};
    for (var i = 0; i < fontNames.length; i++) {
      var key = fontNames[i].family + ":" + fontNames[i].style;
      if (!seen[key]) {
        seen[key] = true;
        await figma.loadFontAsync(fontNames[i]);
      }
    }
    return;
  }

  throw new Error("Unable to load fonts for mixed text node");
}

async function appendToParent(node, parentId, createdNodes) {
  if (!parentId) {
    if (node.type !== "PAGE" && node.parent !== figma.currentPage) {
      figma.currentPage.appendChild(node);
    }
    return;
  }

  var resolvedParentId = resolveAlias(parentId, createdNodes);
  var parent = await findNode(resolvedParentId);
  if (!("appendChild" in parent)) {
    throw new Error("Specified parent cannot contain child nodes");
  }
  if (node.parent !== parent) {
    parent.appendChild(node);
  }
}

async function handleCreatePage(message) {
  var page = figma.createPage();
  page.name = message.name;
  if (page.parent !== figma.root) {
    figma.root.appendChild(page);
  }
  if (message.switchToPage !== false) {
    figma.currentPage = page;
  }
  return {
    id: page.id,
    name: page.name,
    type: page.type,
    switchedToPage: message.switchToPage !== false
  };
}

async function handleCreateFrame(message) {
  var frame = figma.createFrame();
  frame.name = message.name || "Frame";
  applyBasicGeometry(frame, message);
  await appendToParent(frame, message.parentId, {});
  return serializeNode(frame);
}

async function createTextNode(message, createdNodes) {
  var node = figma.createText();
  node.name = message.name || "Text";
  await appendToParent(node, message.parentId, createdNodes);
  await loadFontsForTextNode(node, message.fontName);
  if (message.fontSize !== undefined) {
    node.fontSize = message.fontSize;
  }
  if (message.characters !== undefined) {
    node.characters = message.characters;
  } else if (message.text !== undefined) {
    node.characters = message.text;
  }
  applyBasicGeometry(node, message);
  return node;
}

async function createRectangleNode(message, createdNodes) {
  var node = figma.createRectangle();
  node.name = message.name || "Rectangle";
  applyBasicGeometry(node, message);
  await appendToParent(node, message.parentId, createdNodes);
  return node;
}

async function createSectionNode(message, createdNodes) {
  var node = figma.createSection();
  node.name = message.name || "Section";
  if (message.width !== undefined && message.height !== undefined) {
    if (typeof node.resizeWithoutConstraints === "function") {
      node.resizeWithoutConstraints(message.width, message.height);
    } else if (typeof node.resize === "function") {
      node.resize(message.width, message.height);
    }
  }
  setNumericProp(node, "x", message.x);
  setNumericProp(node, "y", message.y);
  await appendToParent(node, message.parentId, createdNodes);
  return node;
}

async function createStickyNode(message, createdNodes) {
  var node = figma.createSticky();
  node.name = message.name || "Sticky";
  if (message.text !== undefined) {
    node.text.characters = message.text;
  }
  if (message.width !== undefined && message.height !== undefined && typeof node.resize === "function") {
    node.resize(message.width, message.height);
  }
  setNumericProp(node, "x", message.x);
  setNumericProp(node, "y", message.y);
  await appendToParent(node, message.parentId, createdNodes);
  return node;
}

async function createShapeWithTextNode(message, createdNodes) {
  var node = figma.createShapeWithText();
  node.name = message.name || "Shape";
  if (message.shapeType !== undefined) {
    node.shapeType = message.shapeType;
  }
  if (message.text !== undefined) {
    node.text.characters = message.text;
  }
  if (message.width !== undefined && message.height !== undefined && typeof node.resize === "function") {
    node.resize(message.width, message.height);
  }
  setNumericProp(node, "x", message.x);
  setNumericProp(node, "y", message.y);
  await appendToParent(node, message.parentId, createdNodes);
  return node;
}

async function createConnectorNode(message, createdNodes) {
  var node = figma.createConnector();
  var startId = resolveAlias(message.startNodeId, createdNodes);
  var endId = resolveAlias(message.endNodeId, createdNodes);
  if (!startId || !endId) {
    throw new Error("createConnector requires startNodeId and endNodeId");
  }
  node.connectorStart = {
    endpointNodeId: startId,
    magnet: message.startMagnet || "AUTO"
  };
  node.connectorEnd = {
    endpointNodeId: endId,
    magnet: message.endMagnet || "AUTO"
  };
  if (message.text !== undefined && "text" in node) {
    node.text = message.text;
  }
  await appendToParent(node, message.parentId, createdNodes);
  return node;
}

async function handleCreateComponent(message) {
  var component;
  if (message.sourceNodeId) {
    var sourceNode = await findNode(message.sourceNodeId);
    component = figma.createComponentFromNode(sourceNode);
  } else {
    component = figma.createComponent();
    component.name = message.name || "Component";
    applyBasicGeometry(component, message);
    await appendToParent(component, message.parentId, {});
  }

  if (message.name) {
    component.name = message.name;
  }
  if (message.description !== undefined && "description" in component) {
    component.description = message.description;
  }
  applyBasicGeometry(component, message);
  if (message.parentId) {
    await appendToParent(component, message.parentId, {});
  }
  return serializeNode(component);
}

async function upsertCollection(name, reuseCollectionByName) {
  if (reuseCollectionByName !== false) {
    var existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
    for (var i = 0; i < existingCollections.length; i++) {
      if (existingCollections[i].name === name) {
        return existingCollections[i];
      }
    }
  }
  return figma.variables.createVariableCollection(name);
}

function getModeMap(collection) {
  var map = {};
  for (var i = 0; i < collection.modes.length; i++) {
    map[collection.modes[i].name] = collection.modes[i].modeId;
  }
  return map;
}

async function handleCreateTokens(message) {
  var collection = await upsertCollection(
    message.collectionName,
    message.reuseCollectionByName
  );

  if (Array.isArray(message.modes) && message.modes.length > 0) {
    if (typeof collection.renameMode === "function") {
      collection.renameMode(collection.defaultModeId, message.modes[0]);
    }
    for (var i = 1; i < message.modes.length; i++) {
      if (!getModeMap(collection)[message.modes[i]]) {
        collection.addMode(message.modes[i]);
      }
    }
  }

  var modeMap = getModeMap(collection);
  var existingVariablesByName = {};
  if (message.reuseVariablesByName !== false) {
    var existingVariables = await figma.variables.getLocalVariablesAsync();
    for (var j = 0; j < existingVariables.length; j++) {
      var variable = existingVariables[j];
      if (variable.variableCollectionId === collection.id) {
        existingVariablesByName[variable.name] = variable;
      }
    }
  }

  var created = [];
  for (var k = 0; k < message.variables.length; k++) {
    var spec = message.variables[k];
    var token =
      existingVariablesByName[spec.name] ||
      figma.variables.createVariable(spec.name, collection, spec.resolvedType);

    if (spec.description !== undefined) {
      token.description = spec.description;
    }
    if (spec.hiddenFromPublishing !== undefined) {
      token.hiddenFromPublishing = spec.hiddenFromPublishing;
    }
    if (Array.isArray(spec.scopes)) {
      token.scopes = spec.scopes;
    }

    if (spec.valuesByMode) {
      for (var modeName in spec.valuesByMode) {
        if (Object.prototype.hasOwnProperty.call(spec.valuesByMode, modeName)) {
          var modeId = modeMap[modeName];
          if (!modeId) {
            throw new Error("Unknown variable mode: " + modeName);
          }
          token.setValueForMode(modeId, spec.valuesByMode[modeName]);
        }
      }
    } else if (spec.value !== undefined) {
      token.setValueForMode(collection.defaultModeId, spec.value);
    }

    created.push({
      id: token.id,
      name: token.name,
      resolvedType: token.resolvedType,
      variableCollectionId: token.variableCollectionId
    });
  }

  return {
    collection: {
      id: collection.id,
      name: collection.name,
      defaultModeId: collection.defaultModeId,
      modes: collection.modes
    },
    variables: created
  };
}

async function handleSetText(message) {
  var node = await findNode(message.nodeId);
  await loadFontsForTextNode(node);
  node.characters = message.text;
  return {
    id: node.id,
    type: node.type,
    characters: node.characters
  };
}

async function handleSetFills(message) {
  var node = await findNode(message.nodeId);
  if (!("fills" in node)) {
    throw new Error("Target node does not support fills");
  }
  node.fills = normalizeFills(message.fills);
  return {
    id: node.id,
    type: node.type,
    fillCount: node.fills.length
  };
}

async function handleSetLayout(message, createdNodes) {
  var node = await findNode(resolveAlias(message.nodeId, createdNodes));
  applyLayout(node, message.layout || {});
  return serializeNode(node);
}

async function handleCreateComponentSet(message, createdNodes) {
  var componentIds = Array.isArray(message.componentIds) ? message.componentIds : [];
  if (componentIds.length === 0) {
    throw new Error("componentIds must contain at least one component");
  }

  var components = [];
  for (var i = 0; i < componentIds.length; i++) {
    components.push(await findNode(resolveAlias(componentIds[i], createdNodes)));
  }

  var parent = components[0].parent;
  var set = figma.combineAsVariants(components, parent);
  if (message.name) {
    set.name = message.name;
  }
  return serializeNode(set);
}

async function handleDeleteNode(message, createdNodes) {
  var node = await findNode(resolveAlias(message.nodeId, createdNodes));
  var snapshot = serializeNode(node);
  node.remove();
  return snapshot;
}

async function handleApplyOperations(message) {
  var operations = Array.isArray(message.operations) ? message.operations : [];
  var createdNodes = {};
  var results = [];

  for (var i = 0; i < operations.length; i++) {
    var operation = operations[i];
    var result;
    if (operation.type === "createPage") {
      result = await handleCreatePage(operation);
    } else if (operation.type === "createSection") {
      result = serializeNode(await createSectionNode(operation, createdNodes));
    } else if (operation.type === "createFrame") {
      var frame = figma.createFrame();
      frame.name = operation.name || "Frame";
      applyBasicGeometry(frame, operation);
      await appendToParent(frame, operation.parentId, createdNodes);
      result = serializeNode(frame);
    } else if (operation.type === "createSticky") {
      result = serializeNode(await createStickyNode(operation, createdNodes));
    } else if (operation.type === "createShapeWithText") {
      result = serializeNode(await createShapeWithTextNode(operation, createdNodes));
    } else if (operation.type === "createConnector") {
      result = serializeNode(await createConnectorNode(operation, createdNodes));
    } else if (operation.type === "createText") {
      result = serializeNode(await createTextNode(operation, createdNodes));
    } else if (operation.type === "createRectangle") {
      result = serializeNode(await createRectangleNode(operation, createdNodes));
    } else if (operation.type === "createComponent") {
      var componentInput = {};
      for (var key in operation) {
        if (Object.prototype.hasOwnProperty.call(operation, key)) {
          componentInput[key] = operation[key];
        }
      }
      if (componentInput.sourceNodeId) {
        componentInput.sourceNodeId = resolveAlias(componentInput.sourceNodeId, createdNodes);
      }
      if (componentInput.parentId) {
        componentInput.parentId = resolveAlias(componentInput.parentId, createdNodes);
      }
      result = await handleCreateComponent(componentInput);
    } else if (operation.type === "createComponentSet") {
      result = await handleCreateComponentSet(operation, createdNodes);
    } else if (operation.type === "setText") {
      result = await handleSetText({
        nodeId: resolveAlias(operation.nodeId, createdNodes),
        text: operation.text
      });
    } else if (operation.type === "setFills") {
      result = await handleSetFills({
        nodeId: resolveAlias(operation.nodeId, createdNodes),
        fills: operation.fills
      });
    } else if (operation.type === "setLayout") {
      result = await handleSetLayout(operation, createdNodes);
    } else if (operation.type === "deleteNode") {
      result = await handleDeleteNode(operation, createdNodes);
    } else {
      throw new Error("Unsupported operation type: " + operation.type);
    }

    if (operation.id && result && result.id) {
      createdNodes[operation.id] = result.id;
    }

    results.push({
      operationIndex: i,
      operationId: operation.id || null,
      type: operation.type,
      result: result
    });
  }

  return {
    applied: results.length,
    aliases: createdNodes,
    results: results
  };
}

async function handleCaptureScreenshot(message) {
  var targetNode = null;
  if (message.nodeId) {
    targetNode = await findNode(message.nodeId);
  } else if (figma.currentPage.selection.length > 0) {
    targetNode = figma.currentPage.selection[0];
  }

  if (!targetNode) {
    throw new Error("No node provided and current selection is empty");
  }

  if (typeof targetNode.exportAsync !== "function") {
    throw new Error("Target node cannot be exported as an image");
  }

  var format = message.format === "jpg" ? "JPG" : "PNG";
  var bytes = await targetNode.exportAsync({
    format: format,
    constraint: {
      type: "SCALE",
      value: message.scale || 1
    }
  });

  return {
    nodeId: targetNode.id,
    format: message.format === "jpg" ? "jpg" : "png",
    mimeType: message.format === "jpg" ? "image/jpeg" : "image/png",
    bytes: bytes.length,
    base64: message.includeBase64 ? toBase64(bytes) : undefined
  };
}

async function handleExecuteCode(message) {
  var timeoutMs = message.timeoutMs || 5000;
  var wrappedCode = "(async () => {\n" + message.code + "\n})()";
  var executionPromise = Promise.resolve().then(function() {
    return eval(wrappedCode);
  });
  var timeoutPromise = new Promise(function(_, reject) {
    setTimeout(function() {
      reject(new Error("Execution timed out after " + timeoutMs + "ms"));
    }, timeoutMs);
  });

  return Promise.race([executionPromise, timeoutPromise]);
}

async function dispatch(message) {
  if (message.type === "PING") {
    return { ok: true };
  }
  if (message.type === "GET_SELECTION") {
    return getSelectionSnapshot();
  }
  if (message.type === "GET_VARIABLES") {
    return getVariablesPayload();
  }
  if (message.type === "ANALYZE_DESIGN_SYSTEM") {
    return handleAnalyzeDesignSystem(message);
  }
  if (message.type === "CAPTURE_SCREENSHOT") {
    return handleCaptureScreenshot(message);
  }
  if (message.type === "EXECUTE_CODE") {
    return handleExecuteCode(message);
  }
  if (message.type === "CREATE_PAGE") {
    return handleCreatePage(message);
  }
  if (message.type === "CREATE_FRAME") {
    return handleCreateFrame(message);
  }
  if (message.type === "CREATE_COMPONENT") {
    return handleCreateComponent(message);
  }
  if (message.type === "CREATE_TOKENS") {
    return handleCreateTokens(message);
  }
  if (message.type === "APPLY_OPERATIONS") {
    return handleApplyOperations(message);
  }
  if (message.type === "SET_TEXT") {
    return handleSetText(message);
  }
  if (message.type === "SET_FILLS") {
    return handleSetFills(message);
  }

  throw new Error("Unsupported command: " + message.type);
}

function sendFileInfo() {
  post("FILE_INFO", { data: getFileInfo() });
}

async function sendVariablesData() {
  try {
    post("VARIABLES_DATA", { data: await getVariablesPayload() });
  } catch (error) {
    post("ERROR", { error: error && error.message ? error.message : String(error) });
  }
}

function sendSelectionChange() {
  post("SELECTION_CHANGE", { data: getSelectionSnapshot() });
}

figma.on("selectionchange", sendSelectionChange);
figma.on("currentpagechange", function() {
  sendFileInfo();
  sendSelectionChange();
});

figma.ui.onmessage = async function(message) {
  if (!message || !message.type) {
    return;
  }

  try {
    var result = await dispatch(message);
    post("COMMAND_RESULT", {
      requestId: message.requestId,
      success: true,
      result: result
    });
    if (
      message.type === "CREATE_PAGE" ||
      message.type === "CREATE_FRAME" ||
      message.type === "CREATE_COMPONENT" ||
      message.type === "CREATE_TOKENS" ||
      message.type === "APPLY_OPERATIONS" ||
      message.type === "SET_TEXT" ||
      message.type === "SET_FILLS"
    ) {
      sendFileInfo();
      sendSelectionChange();
      sendVariablesData();
    }
  } catch (error) {
    post("COMMAND_RESULT", {
      requestId: message.requestId,
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  }
};

sendFileInfo();
sendSelectionChange();
sendVariablesData();
