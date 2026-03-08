import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  applyOperationsSchema,
  createComponentSchema,
  createFrameSchema,
  createPageSchema,
  createTokensSchema
} from "../src/core/tools/write-tools.js";
import { extractDesignSystemSchema } from "../src/core/tools/read-tools.js";

const schemas = [
  {
    name: "figma_create_page",
    schema: z.object(createPageSchema),
    valid: { name: "Tokens", switchToPage: true },
    invalid: { name: "" }
  },
  {
    name: "figma_create_frame",
    schema: z.object(createFrameSchema),
    valid: {
      width: 120,
      height: 48,
      layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 }
    },
    invalid: { width: 0, height: 48 }
  },
  {
    name: "figma_create_component",
    schema: z.object(createComponentSchema),
    valid: { name: "Button", width: 120, height: 48 },
    invalid: { width: -1, height: 48 }
  },
  {
    name: "figma_create_tokens",
    schema: z.object(createTokensSchema),
    valid: {
      collectionName: "Primitives",
      variables: [{ name: "color/brand", resolvedType: "COLOR", value: { r: 1, g: 0, b: 0 } }]
    },
    invalid: { collectionName: "Primitives", variables: [] }
  },
  {
    name: "figma_apply_operations",
    schema: z.object(applyOperationsSchema),
    valid: { operations: [{ type: "createFrame", id: "root", width: 100, height: 100 }] },
    invalid: { operations: [] }
  },
  {
    name: "figma_extract_design_system",
    schema: z.object(extractDesignSystemSchema),
    valid: { pageNames: ["Colours"], includeComponents: true, maxEntriesPerBucket: 12 },
    invalid: { maxEntriesPerBucket: 100 }
  }
];

for (const entry of schemas) {
  test(`${entry.name} schema accepts valid input`, () => {
    assert.doesNotThrow(() => entry.schema.parse(entry.valid));
  });

  test(`${entry.name} schema rejects invalid input`, () => {
    assert.throws(() => entry.schema.parse(entry.invalid));
  });
}
