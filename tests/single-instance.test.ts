import test from "node:test";
import assert from "node:assert/strict";
import { getAncestorPids } from "../src/core/single-instance.js";

test("getAncestorPids walks the current process ancestry without looping", () => {
  const processes = [
    { pid: 10, ppid: 1, command: "launcher" },
    { pid: 20, ppid: 10, command: "tsx src/local.ts" },
    { pid: 30, ppid: 20, command: "node src/local.ts" },
    { pid: 40, ppid: 30, command: "esbuild" }
  ];

  const ancestors = getAncestorPids(processes, 30, 20);

  assert.deepEqual([...ancestors], [20, 10, 1]);
});

test("getAncestorPids stops on malformed self-parented entries", () => {
  const processes = [{ pid: 50, ppid: 50, command: "broken-process" }];

  const ancestors = getAncestorPids(processes, 99, 50);

  assert.deepEqual([...ancestors], [50]);
});
