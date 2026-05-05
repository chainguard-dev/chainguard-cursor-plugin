#!/usr/bin/env node
// Copyright 2026 Chainguard, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Chainguard MCP OAuth proxy.
 *
 * Reads a cached OAuth access token from ~/.cursor/cg-mcp-auth.json and
 * bridges stdio (Cursor) to the upstream HTTP MCP server.
 *
 * If no valid token is cached, exits immediately with instructions to run
 * setup.js first. If the token is refreshed mid-session (by re-running
 * setup.js), the upstream connection is transparently re-established.
 *
 * Cursor config (in ~/.cursor/mcp.json):
 *   { "type": "stdio", "command": "node", "args": ["/path/to/proxy.js", "<mcp-url>"] }
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const UPSTREAM_URL = process.argv[2];
if (!UPSTREAM_URL) {
  process.stderr.write("Usage: node proxy.js <mcp-server-url>\n");
  process.exit(1);
}

const SETUP_SCRIPT    = join(dirname(fileURLToPath(import.meta.url)), "setup.js");
const CACHE_FILE      = join(homedir(), ".cursor", "cg-mcp-auth.json");
const TOKEN_BUFFER_MS = 60_000;

// ── Cache ────────────────────────────────────────────────────────────────────

function loadCache() {
  try { return existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {}; }
  catch { return {}; }
}

// ── Token management ──────────────────────────────────────────────────────────

function getCachedToken(resource) {
  const cached = loadCache()[`token:${resource}`];
  if (cached?.accessToken && cached.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
    return cached.accessToken;
  }
  return null;
}

// ── Resolve resource URI from OAuth protected resource metadata ───────────────

async function resolveResource(serverUrl) {
  const origin = new URL(serverUrl).origin;
  try {
    const res = await fetch(`${origin}/.well-known/oauth-protected-resource`);
    if (res.ok) {
      const meta = await res.json();
      return meta.resource ?? `${origin}/`;
    }
  } catch {}
  return `${origin}/`;
}

// ── Upstream client — reconnects automatically when token changes ─────────────

async function makeUpstreamClient(token) {
  const client = new Client(
    { name: "cg-mcp-proxy", version: "0.1.0" },
    { capabilities: {} }
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(UPSTREAM_URL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    })
  );
  return client;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const resource = await resolveResource(UPSTREAM_URL);

let activeToken = getCachedToken(resource);
if (!activeToken) {
  process.stderr.write(
    `\n[cg-mcp-proxy] No valid token for ${resource}\n` +
    `Run setup first:\n\n  node ${SETUP_SCRIPT}\n\n` +
    `Then restart Cursor (or reload MCP servers in Settings).\n\n`
  );
  process.exit(1);
}

let upstreamClient = await makeUpstreamClient(activeToken);
let { tools } = await upstreamClient.listTools();

const localServer = new Server(
  { name: "cg-mcp-proxy", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

localServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

localServer.setRequestHandler(CallToolRequestSchema, async (req) => {
  const freshToken = getCachedToken(resource);

  if (!freshToken) {
    return {
      content: [{ type: "text", text:
        "Chainguard MCP token has expired.\n" +
        `Run: node ${SETUP_SCRIPT}\n` +
        "Then open a new agent session and try again."
      }],
      isError: true,
    };
  }

  // Token was refreshed by setup.js while proxy was running — reconnect.
  if (freshToken !== activeToken) {
    process.stderr.write("[cg-mcp-proxy] Token refreshed, reconnecting upstream...\n");
    await upstreamClient.close();
    upstreamClient = await makeUpstreamClient(freshToken);
    activeToken = freshToken;
    ({ tools } = await upstreamClient.listTools());
  }

  return upstreamClient.callTool({
    name: req.params.name,
    arguments: req.params.arguments ?? {},
  });
});

await localServer.connect(new StdioServerTransport());
