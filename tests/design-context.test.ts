import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDesignContext } from "../src/core/design-context.js";

test("normalizeDesignContext produces stable output shape", () => {
  const normalized = normalizeDesignContext({
    fileKey: "FILE123",
    fileData: {
      name: "Design File",
      lastModified: "2026-03-07T10:00:00.000Z",
      version: "42",
      role: "owner",
      document: {
        editorType: "figma"
      }
    },
    nodeId: "1:2",
    node: {
      id: "1:2",
      name: "Button",
      type: "FRAME",
      visible: true,
      absoluteBoundingBox: {
        width: 120,
        height: 44
      },
      fills: [{ type: "SOLID" }],
      characters: "Submit",
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 16,
      children: [{ id: "1:3", name: "Label", type: "TEXT" }]
    },
    variables: {
      source: "plugin",
      collections: [{ id: "c1" }],
      variables: [{ id: "v1" }]
    },
    screenshot: {
      nodeId: "1:2",
      mimeType: "image/png",
      format: "png",
      savedTo: "/tmp/button.png"
    },
    screenshotSource: "plugin",
    variableSource: "plugin"
  });

  assert.equal(normalized.file.fileKey, "FILE123");
  assert.equal(normalized.node?.id, "1:2");
  assert.equal(normalized.layout?.padding?.left, 16);
  assert.equal(normalized.variables.source, "plugin");
  assert.equal(normalized.screenshot?.savedTo, "/tmp/button.png");
  assert.equal(normalized.source.screenshot, "plugin");
});
