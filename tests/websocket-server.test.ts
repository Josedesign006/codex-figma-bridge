import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { FigmaWebSocketServer } from "../src/core/websocket-server.js";

function openClient(serverPort: number): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

test("websocket server correlates requests and responses", async () => {
  const server = new FigmaWebSocketServer({ host: "127.0.0.1", port: 9433 });
  await server.start();
  const address = server.address();
  assert.ok(address);
  const port = address.port;
  const client = await openClient(port);

  client.send(
    JSON.stringify({
      type: "FILE_INFO",
      data: {
        fileName: "Test File",
        fileKey: "FILE_1"
      }
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 10));

  client.on("message", (raw: WebSocket.RawData) => {
    const message = JSON.parse(raw.toString());
    client.send(JSON.stringify({ id: message.id, result: { ok: true, method: message.method } }));
  });

  try {
    const result = await server.sendCommand("PING", {}, 1000);
    assert.deepEqual(result, { ok: true, method: "PING" });
  } finally {
    client.close();
    await server.stop();
  }
});

test("websocket server times out pending requests", async () => {
  const server = new FigmaWebSocketServer({ host: "127.0.0.1", port: 9434 });
  await server.start();
  const address = server.address();
  assert.ok(address);
  const port = address.port;
  const client = await openClient(port);

  client.send(
    JSON.stringify({
      type: "FILE_INFO",
      data: {
        fileName: "Test File",
        fileKey: "FILE_2"
      }
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 10));

  await assert.rejects(
    server.sendCommand("PING", {}, 50),
    /timed out/
  );

  client.close();
  await server.stop();
});
