---
name: chainguard-compare-versions
description: Compare versions of a Chainguard image, show changelogs, and identify the latest digest. Use when the user asks what changed between image versions or wants to pin to a specific digest.
---

# Compare Chainguard Image Versions

**IMPORTANT: You must complete org resolution (Step 1) before querying for any images. Do not use `cgr.dev/chainguard` as the org without first confirming the user has no private organizations.**

Use the `cg-api` MCP server to identify the user's organization, then `cg-versions` for version history and `cg-oci` to resolve digests.

## Steps

1. **Resolve the target organization — do this first, before any image lookup.**
   a. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set (non-empty), use that org and proceed to step 2.
   b. If no chainctl default is set, call the `cg-api` MCP server to list all organizations the user has access to.
      - If exactly one org is returned: use it automatically, tell the user which org you're using, and proceed to step 2.
      - If multiple orgs are returned: show a numbered list and **stop. You do not have enough information to decide which org is correct — only the user knows which catalog they want. Do not offer an opinion, do not suggest a "normal" or "typical" choice, do not add any hints or parenthetical examples after the question, do not proceed with any org. Ask only: "Which organization would you like to use?" and wait for their reply.**
      - If no orgs are returned: only then use `cgr.dev/chainguard` and note that the user appears to have no private organizations.
   Use the resolved org slug in all image references: `cgr.dev/<org-slug>/<image>`.
2. Query `cg-versions` for the version history of the requested image within that organization.
3. Present a summary of recent versions including:
   - Tag names and dates
   - Package version bumps (e.g., `openssl 3.1.4 → 3.1.5`)
   - CVE fixes included in each version
4. Resolve the digest for each version via `cg-oci` and include it in the output.
5. If the user provides a specific version, highlight what changed between that version and the current latest.

## Example Output

```
Image: cgr.dev/mycompany/python

latest (2024-03-15)  sha256:abc123...
  - python 3.12.2 → 3.12.3
  - Fixed: CVE-2024-0450 (zipimport)

2024-03-01           sha256:def456...
  - openssl 3.2.0 → 3.2.1
  - Fixed: CVE-2024-0727
```

## Handling auth errors

If any MCP server call returns a 401 or 403 error, the OAuth tokens have expired. Tell the user:
> "Your Chainguard MCP tokens have expired. Run `node /path/to/chainguard-cursor-plugin/proxy/setup.js`, then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- Always include digests — do not omit them.
- Recommend digest pinning in production and automated update tooling (e.g., Renovate, Dependabot) to track Chainguard image updates.
- If version history is not available for the user's org, say so explicitly rather than falling back to the public catalog.
