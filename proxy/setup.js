#!/usr/bin/env node
// Copyright 2026 Chainguard, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Chainguard MCP auth setup.
 * Run this once (or when tokens expire) to authenticate all four MCP servers.
 * After this completes, Cursor's MCP servers connect instantly without any
 * browser interaction.
 *
 * Usage: node setup.js
 */

import { createServer } from "http";
import { createHash, randomBytes } from "crypto";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";

const ISSUER        = "https://issuer.enforce.dev";
const REGISTER_URL  = `${ISSUER}/register`;
const AUTH_URL      = `${ISSUER}/authorize`;
const TOKEN_URL     = `${ISSUER}/token`;
const CACHE_FILE    = join(homedir(), ".cursor", "cg-mcp-auth.json");
const LOGIN_TIMEOUT = 5 * 60 * 1000;

const SERVERS = [
  { name: "cg-api",      url: "https://console-api.enforce.dev/mcp" },
  { name: "cg-apk",      url: "https://apk.cgr.dev/mcp" },
  { name: "cg-oci",      url: "https://cgr.dev/mcp" },
  { name: "cg-versions", url: "https://versions.cgr.dev/mcp" },
];

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makePKCE() {
  const verifier  = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  try { execFileSync(cmd, [url]); } catch {
    console.log(`  Please open this URL manually:\n  ${url}`);
  }
}

function loadCache() {
  try { return existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {}; }
  catch { return {}; }
}

function saveCache(patch) {
  const updated = { ...loadCache(), ...patch };
  mkdirSync(dirname(CACHE_FILE), { recursive: true, mode: 0o700 });
  writeFileSync(CACHE_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
  chmodSync(CACHE_FILE, 0o600);
}

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

async function authenticate(serverName, resource) {
  const { verifier, challenge } = makePKCE();
  const state    = randomBytes(16).toString("hex");
  const port     = Math.floor(Math.random() * 10000) + 40000;
  const callback = `http://localhost:${port}/oauth/callback`;

  // Register a fresh client for this port
  const regRes = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name:                "Chainguard Cursor Plugin",
      redirect_uris:              [callback],
      grant_types:                ["authorization_code"],
      response_types:             ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`);
  const { client_id } = await regRes.json();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`Login timed out for ${serverName}`));
    }, LOGIN_TIMEOUT);

    const server = createServer(async (req, res) => {
      const u = new URL(req.url, `http://localhost:${port}`);
      if (u.pathname !== "/oauth/callback") { res.end(); return; }

      clearTimeout(timer);
      server.close();

      if (u.searchParams.get("state") !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h2>&#x274C; Authentication failed</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>`);
        return reject(new Error("State mismatch"));
      }

      const code = u.searchParams.get("code");
      if (!code) {
        const errMsg = u.searchParams.get("error_description") ?? "no code";
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
          <h2>&#x274C; Authentication failed: ${errMsg}</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>`);
        return reject(new Error(errMsg));
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:2rem">
        <h2>&#x2705; Authenticated: ${serverName}</h2>
        <p>You can close this tab and return to the terminal.</p>
      </body></html>`);

      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "authorization_code",
          code,
          redirect_uri:  callback,
          client_id,
          code_verifier: verifier,
        }).toString(),
      });
      if (!tokenRes.ok) return reject(new Error(`Token exchange failed: ${await tokenRes.text()}`));

      const data = await tokenRes.json();
      resolve(data);
    });

    server.on("error", (err) => { clearTimeout(timer); reject(err); });

    server.listen(port, "localhost", () => {
      const params = new URLSearchParams({
        response_type:         "code",
        client_id,
        redirect_uri:          callback,
        state,
        code_challenge:        challenge,
        code_challenge_method: "S256",
        resource,
      });
      console.log(`\n  Opening browser for: ${serverName}`);
      openBrowser(`${AUTH_URL}?${params}`);
      console.log(`  Waiting for login... (complete it in the browser)`);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("Chainguard MCP Setup");
console.log("====================");
console.log("This will open a browser tab for each of the four Chainguard");
console.log("MCP servers. Complete each login before the next tab opens.\n");

let allOk = true;

for (const server of SERVERS) {
  const resource  = await resolveResource(server.url);
  const cacheKey  = `token:${resource}`;
  const cached    = loadCache()[cacheKey];
  const stillGood = cached?.accessToken && cached.expiresAt > Date.now() + 60_000;

  if (stillGood) {
    const mins = Math.round((cached.expiresAt - Date.now()) / 60_000);
    console.log(`  ✓ ${server.name} — token valid for ~${mins} more minutes, skipping`);
    continue;
  }

  try {
    const tokenData = await authenticate(server.name, resource);
    const expiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
    saveCache({ [cacheKey]: { accessToken: tokenData.access_token, expiresAt } });
    console.log(`  ✓ ${server.name} — authenticated (token valid for ${Math.round((tokenData.expires_in ?? 3600) / 60)} minutes)`);
  } catch (err) {
    console.error(`  ✗ ${server.name} — ${err.message}`);
    allOk = false;
  }
}

console.log(allOk
  ? "\n✅ All servers authenticated. Restart Cursor and the MCP servers will connect instantly."
  : "\n⚠️  Some servers failed. Re-run this script to retry them.");
