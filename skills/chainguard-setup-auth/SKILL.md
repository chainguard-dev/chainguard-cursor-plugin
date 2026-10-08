---
name: chainguard-setup-auth
description: Verify and set up Chainguard authentication using chainctl. Use when the user asks how to log in, check auth status, or when Chainguard commands are failing due to missing credentials.
---

# Set Up Chainguard Authentication

Before running any checks, tell the user what to expect if login is needed:

- They will need to open a login link in their browser and complete sign-in there. Ask them to stay nearby and not navigate away — the link expires in about 10 minutes.
- After login, access tokens are short-lived (~1 hour), but `chainctl` renews them automatically with a stored refresh token, so they normally will not need to log in again during this session. If commands start failing later, re-run this skill.

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

`chainctl` must reach `*.enforce.dev` and `auth.chainguard.dev`. Run every `chainctl` command with full network access. A `context deadline exceeded` error means the network was blocked, not that the user is logged out.

If not logged in:

1. Ask how the user signs in with the ask-questions tool: Google, GitHub, GitLab, email, or an organization domain. Then start the matching command in the background, outside the sandbox, with network access. Do not block the turn on it.
   - Google, GitHub, GitLab, or email: `chainctl auth login --social-login=<google|github|gitlab|email>`
   - Organization custom identity provider: `chainctl auth login --org-name=<verified-domain>` (use the verified domain, for example `example.com`, not the display name)
   - Do not run bare `chainctl auth login` with no flags; it prompts for an identity provider on a TTY the agent cannot answer.
   - Do not add `--headless` by default; it saves headless as the default login mode. The URL is already printed when the agent shell cannot open a browser.
2. Read the command output only until `Visit this URL on any device with a browser to authenticate: <url>` appears (or until it reports that a browser opened).
3. Immediately call the ask-questions tool again. Put the full URL in the question text and tell the user to open it. Options: "I've signed in" and "The link expired, send a new one". This is what shows the URL. Do not end the turn, and do not keep waiting on the login command before asking — the question is what holds the turn open while the login process keeps running.
4. After they answer, check whether the login process exited successfully, then re-run `chainctl auth status`. If they say the link expired, or the process exited with `timed out waiting`, start a new login and ask again with the new URL.

## Step 3: Confirm access

```bash
chainctl iam organizations list
```

A successful response confirms the user can reach the Chainguard platform and commands will work.

## Notes

- `chainctl` handles all interactions with the Chainguard platform. MCP tools, when available, use the same session.
- Tokens are short-lived (~1 hour). If commands start failing, re-run `chainctl auth login`.
- For CI or scripted use: `chainctl auth token` prints a raw token suitable for `Authorization: Bearer` headers.
