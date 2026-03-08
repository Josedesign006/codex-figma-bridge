import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { startBridgeServer } from "../src/core/server-bootstrap.js";

test("startBridgeServer falls back when the preferred port is occupied", async () => {
  const blocker = net.createServer();
  await new Promise<void>((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(9423, "127.0.0.1", () => resolve());
  });

  const started = await startBridgeServer(9423, "127.0.0.1");

  try {
    assert.equal(started.actualPort, 9424);
  } finally {
    await started.server.stop();
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
});
