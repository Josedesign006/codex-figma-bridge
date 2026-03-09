# Codex Figma Bridge

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)](https://nodejs.org/)
[![Figma Desktop](https://img.shields.io/badge/Figma-Desktop-orange)](https://www.figma.com/downloads/)

> Local MCP bridge for connecting Codex to Figma Desktop.
> Use it to read design data, inspect files, capture screenshots, and create or update frames, components, text, fills, and tokens directly in Figma.

## Installation

Use this if you want the standard local setup.

Run the commands in your system terminal app, not in Figma.
Examples: Terminal on macOS, iTerm, Windows Terminal, or a shell inside VS Code.

### Prerequisites

- Node.js `20+`
- Figma Desktop
- Codex desktop app or another MCP client that supports local stdio servers
- A Figma personal access token for REST-backed reads

### Step 1. Clone and install

```bash
git clone https://github.com/Josedesign006/codex-figma-bridge.git
cd codex-figma-bridge
npm install
```

### Step 2. Set your Figma token

```bash
export FIGMA_ACCESS_TOKEN=figd_your_token_here
```

Get a token here:
[Figma personal access tokens](https://www.figma.com/developers/api#access-tokens)

If you skip this, the bridge still runs, but REST-backed tools will not work until you add a real token.

### Step 3. Add the MCP server to Codex

Recommended:

```bash
npm run setup -- --install-codex
```

This does three things:

- Adds the server to `~/.codex/config.toml`
- Creates a backup at `~/.codex/config.toml.bak-codex-figma-bridge`
- Generates `codex.mcp.json` in the repo

Manual option:

```bash
npm run setup
```

Then copy the generated `codex.mcp.json` entry into your MCP client config manually.

### Step 4. Install the Figma Development plugin

In Figma Desktop:

1. Open `Plugins -> Development -> Import plugin from manifest...`
2. Select [figma-plugin/manifest.json](/Users/nilmanikumar/Documents/Codex%20app%20explore/codex-figma-bridge/figma-plugin/manifest.json)
3. Open the file you want to work with
4. Run `Codex Figma Bridge`
5. Keep the plugin open while using the MCP tools

### Step 5. Restart Codex

Restart Codex after setup so it loads the new MCP server.

### Step 6. Verify the bridge

```bash
npm run status
```

If everything is installed correctly:

- Codex should show the MCP server
- The Figma plugin should connect on localhost
- Write tools should work when the plugin is open in the target file

## What It Does

This repo runs a local MCP server and a Figma Development plugin that talk over localhost WebSocket.

It supports:

- Status and connection checks
- File reads, variables, styles, and active selection
- Node screenshots and design context extraction
- Creating pages, frames, components, and tokens
- Applying batched operations to a live Figma file

## How It Works

- The MCP server runs from `src/local.ts`
- The Figma plugin connects only to `ws://localhost:9233-9242`
- Active-file write operations require the Figma Desktop plugin to be open in that file
- REST-backed reads use `FIGMA_ACCESS_TOKEN`

## Available Tools

### Read

- `figma_get_status`
- `figma_get_file_data`
- `figma_get_variables`
- `figma_get_styles`
- `figma_get_selection`
- `figma_extract_design_system`
- `figma_get_design_context`
- `figma_take_screenshot`

### Write

- `figma_create_page`
- `figma_create_frame`
- `figma_create_component`
- `figma_create_tokens`
- `figma_apply_operations`
- `figma_set_text`
- `figma_set_fills`
- `figma_execute`

## Commands

```bash
npm run setup         # generate codex.mcp.json
npm run setup:codex   # update ~/.codex/config.toml directly
npm run dev           # start the bridge locally
npm run status        # inspect running bridge ports/processes
npm run build         # build TypeScript output
npm test              # run tests
```

## Security Notes

- Do not commit tokens or paste them into screenshots
- Prefer `FIGMA_ACCESS_TOKEN` in your shell environment
- `codex.mcp.json` is gitignored because it can contain local machine paths and tokens
- The bridge binds to localhost only

## Troubleshooting

### Figma is not connecting

- Make sure you are using Figma Desktop, not only the browser
- Confirm the Development plugin is imported from `figma-plugin/manifest.json`
- Keep the plugin open in the target file

### Read tools fail with token errors

- Check that `FIGMA_ACCESS_TOKEN` is set
- Re-run `npm run setup -- --install-codex`
- Restart Codex after updating config

### Port conflicts

The bridge scans localhost ports `9233-9242` automatically and uses the first open port.

## License

[MIT](./LICENSE)
