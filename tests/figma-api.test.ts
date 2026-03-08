import test from "node:test";
import assert from "node:assert/strict";
import { extractFileKey, extractFigmaUrlInfo } from "../src/core/figma-api.js";

test("extractFileKey parses design URLs", () => {
  assert.equal(
    extractFileKey("https://www.figma.com/design/AbC123/My-File"),
    "AbC123"
  );
});

test("extractFigmaUrlInfo parses node ids and branch ids", () => {
  assert.deepEqual(
    extractFigmaUrlInfo(
      "https://www.figma.com/design/AbC123/My-File?branch-id=Br456&node-id=12-34"
    ),
    {
      fileKey: "AbC123",
      branchId: "Br456",
      nodeId: "12:34"
    }
  );
});

test("extractFigmaUrlInfo parses branch path format", () => {
  assert.deepEqual(
    extractFigmaUrlInfo(
      "https://www.figma.com/design/AbC123/branch/Br456/My-File?node-id=10-20"
    ),
    {
      fileKey: "AbC123",
      branchId: "Br456",
      nodeId: "10:20"
    }
  );
});
