# Codex Figma Bridge

Use this repo as a local MCP bridge between Codex and Figma Desktop.

This is the clean public-release repo with the latest bridge only.

## Quick start

```bash
npm install
npm run setup
```

`npm run setup` does one thing:

- generates a ready-to-copy Codex MCP config at `codex.mcp.json`

If you want the simplest path, use this instead:

```bash
export FIGMA_ACCESS_TOKEN=figd_your_token_here
```

```bash
npm install
npm run setup -- --install-codex
```

That command:

- writes the MCP server directly into `~/.codex/config.toml`
- keeps a backup at `~/.codex/config.toml.bak-codex-figma-bridge`
- still generates `codex.mcp.json` in the repo as a fallback

After that, the user journey is:

1. In Figma Desktop, import `figma-plugin/manifest.json` as a Development plugin.
2. In Codex, either:
   - let `npm run setup -- --install-codex` update `~/.codex/config.toml` automatically, or
   - add the MCP config from `codex.mcp.json` manually
3. Open the `Codex Figma Bridge` plugin in the Figma file you want to use.

That is the main path.

## What users import

- Figma plugin manifest: `figma-plugin/manifest.json`
- MCP server entrypoint: `src/local.ts` through the repo-local `tsx` binary

## What the bridge supports

- status: `figma_get_status`
- file reads: `figma_get_file_data`, `figma_get_variables`, `figma_get_styles`, `figma_get_selection`
- analysis: `figma_extract_design_system`, `figma_get_design_context`, `figma_take_screenshot`
- writes: `figma_create_page`, `figma_create_frame`, `figma_create_component`, `figma_create_tokens`, `figma_apply_operations`, `figma_set_text`, `figma_set_fills`, `figma_execute`

## Requirements

- Node.js `20+`
- Figma Desktop
- `FIGMA_ACCESS_TOKEN` for REST-backed file reads

The plugin-only local path still works without a token for active-file operations.

## Commands

- `npm run setup`: generate `codex.mcp.json`
- `npm run setup -- --install-codex`: update Codex config automatically and write the token from `FIGMA_ACCESS_TOKEN` into the bridge server block
- `npm run setup:codex`: shorthand for automatic Codex config install
- `npm run dev`: start the bridge manually for debugging
- `npm run status`: print local bridge status
- `npm run build`: build the repo
- `npm test`: run tests

There is no separate legacy bridge path in the normal repo anymore. The latest bridge is the only supported local path.

## Security notes

- Do not paste personal access tokens into screenshots, shell history, or Git commits.
- Prefer setting `FIGMA_ACCESS_TOKEN` in your shell environment or using the setup prompt.
- `codex.mcp.json` is gitignored because it can contain local machine paths and tokens.
- The bridge only binds to localhost and the Figma plugin only connects to localhost WebSocket ports `9233-9242`.
