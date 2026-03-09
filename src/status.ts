#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function safeExec(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const listeners = safeExec("lsof", ["-nP", "-iTCP:9233-9242", "-sTCP:LISTEN"]);
const bridgeProcesses = safeExec("ps", ["-Ao", "pid=,command="])
  .split("\n")
  .filter((line) => /dist\/local\.js|tsx src\/local\.ts/.test(line))
  .join("\n");

const output = {
  listeners: listeners ? listeners.split("\n") : [],
  bridgeProcesses: bridgeProcesses ? bridgeProcesses.split("\n").map((line) => line.trim()) : []
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
