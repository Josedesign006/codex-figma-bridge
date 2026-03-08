import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = process.platform === "win32"
  ? join(repoRoot, "node_modules", ".bin", "tsx.cmd")
  : join(repoRoot, "node_modules", ".bin", "tsx");
const sourceEntry = join(repoRoot, "src", "local.ts");
const manifestPath = join(repoRoot, "figma-plugin", "manifest.json");
const configPath = join(repoRoot, "codex.mcp.json");
const args = process.argv.slice(2);

function readFlag(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

function escapeTomlString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function upsertCodexBridgeBlock(source, block) {
  const normalized = source.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const output = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "[mcp_servers.codex_figma_bridge]" || trimmed === "[mcp_servers.codex_figma_bridge.env]") {
      skipping = true;
      continue;
    }
    if (skipping && /^\[/.test(trimmed)) {
      skipping = false;
    }
    if (!skipping) {
      output.push(line);
    }
  }

  const cleaned = output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  return `${cleaned}\n\n${block}\n`;
}

const tokenValue = readFlag("--token") || process.env.FIGMA_ACCESS_TOKEN || "figd_your_token_here";
const codexConfigPath = readFlag("--codex-config")
  || process.env.CODEX_CONFIG_PATH
  || join(process.env.HOME || "", ".codex", "config.toml");
const installCodex = hasFlag("--install-codex");

mkdirSync(dirname(configPath), { recursive: true });

const config = {
  mcpServers: {
    "codex-figma-bridge": {
      command: tsxBin,
      args: [sourceEntry],
      env: {
        FIGMA_ACCESS_TOKEN: tokenValue
      }
    }
  }
};

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

if (installCodex) {
  mkdirSync(dirname(codexConfigPath), { recursive: true });
  const existing = existsSync(codexConfigPath) ? readFileSync(codexConfigPath, "utf8") : "";
  if (existsSync(codexConfigPath)) {
    copyFileSync(codexConfigPath, `${codexConfigPath}.bak-codex-figma-bridge`);
  }
  const block = [
    "[mcp_servers.codex_figma_bridge]",
    `command = "${escapeTomlString(tsxBin)}"`,
    `args = ["${escapeTomlString(sourceEntry)}"]`,
    "",
    "[mcp_servers.codex_figma_bridge.env]",
    `FIGMA_ACCESS_TOKEN = "${escapeTomlString(tokenValue)}"`
  ].join("\n");
  writeFileSync(codexConfigPath, upsertCodexBridgeBlock(existing, block), "utf8");
}

console.log("");
console.log("Setup complete.");
console.log("");
console.log("Use this bridge in 3 steps:");
console.log(`1. Import this Figma plugin manifest: ${manifestPath}`);
if (installCodex) {
  console.log(`2. Codex config was updated automatically: ${codexConfigPath}`);
} else {
  console.log(`2. Add this MCP config to Codex: ${configPath}`);
}
console.log("3. Open the plugin in the target Figma file and keep it open.");
console.log("");
console.log("Fast path:");
console.log("npm run setup -- --token figd_your_token_here --install-codex");
if (!process.env.FIGMA_ACCESS_TOKEN) {
  console.log("");
  console.log("If no token is passed, codex.mcp.json uses a placeholder token.");
  console.log("Replace figd_your_token_here with your real token before using REST-backed tools.");
}
