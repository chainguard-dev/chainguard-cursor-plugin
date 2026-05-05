---
name: chainguard-setup-auth
description: Verify and set up Chainguard authentication using chainctl. Use when the user asks how to log in, check auth status, or when Chainguard commands are failing due to missing credentials.
---

# Set Up Chainguard Authentication

Run these checks in order. Stop as soon as one fails and fix it before continuing.

## Step 1: Check if chainctl is installed

```bash
chainctl version
```

If missing, install it:

```bash
# macOS
brew install chainguard-dev/tap/chainctl

# Linux
curl -s "https://dl.enforce.dev/chainctl/latest/chainctl_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m).tar.gz" | tar xz -C /usr/local/bin
```

## Step 2: Check authentication status

```bash
chainctl auth status
```

If not logged in, run:

```bash
chainctl auth login
```

This opens a browser for OIDC login. Complete the flow and return to Cursor.

## Step 3: Confirm access

```bash
chainctl iam organizations list
```

A successful response confirms the user can reach the Chainguard platform and commands will work.

## Notes

- `chainctl` handles all interactions with the Chainguard platform. MCP tools, when available, use the same session.
- Tokens are short-lived (~1 hour). If commands start failing, re-run `chainctl auth login`.
- For CI or scripted use: `chainctl auth token` prints a raw token suitable for `Authorization: Bearer` headers.
