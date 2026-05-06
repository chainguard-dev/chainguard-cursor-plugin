---
name: chainguard-compare-versions
description: Compare versions of a Chainguard image, show changelogs, and identify the latest digest. Use when the user asks what changed between image versions or wants to pin to a specific digest.
---

# Compare Chainguard Image Versions

**HARD RULES — read before doing anything else:**
1. **If the user provided a full image reference** (e.g., `cgr.dev/chainguard-private/node`), extract the org slug from it and skip all org resolution steps. Do not run `chainctl config view`. Do not call `cg-api` to list orgs. Do not ask the user which org to use. The org is already in the reference.
2. **Make one bounded MCP call at a time.** Write a one-sentence summary of the result before making the next call. Never issue two tool calls in the same step.
3. **Never call any listing or enumeration tool** — specifically: `registry_list`, `repos_list`, `tags_list`, `catalog_list`, `order_by`, or any tool that returns results across multiple images or repos. These return unbounded payloads and freeze the UI. If you would need such a call to proceed, skip that step and tell the user you could not retrieve that data.
4. **If `cg-versions` returns no results, stop.** Report that the image has no version history in the versions catalog and ask the user to verify the image name. Do not attempt any fallback via `cg-oci`.

## Steps

1. **Org resolution** — only run this if the user did NOT provide a full `cgr.dev/<org>/` reference.
   a. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set, use it and proceed to step 2.
   b. If no default is set, call `cg-api` to list organizations.
      - Exactly one org: use it automatically, tell the user, and proceed.
      - Multiple orgs: **display them as a numbered list**, then ask: "Which organization would you like to use?" and stop. Do not proceed until the user replies.
      - No orgs: use `cgr.dev/chainguard` and note the user has no private organizations.

2. Call `cg-versions` for the **two most recent versions only** of the specified image. Output a one-sentence summary of what was returned before continuing.

3. Use any digests returned by `cg-versions` directly. Only call `cg-oci` if a digest is genuinely absent — and only with the exact fully-qualified reference (e.g., `cgr.dev/chainguard-private/node:latest`), never with a listing call.

4. Present the diff:
   - Tag names and dates
   - Package version bumps (e.g., `openssl 3.1.4 → 3.1.5`)
   - CVE fixes included in each version
   - Digests for pinning

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
> "Your Chainguard MCP session has expired. In Cursor, go to Settings → MCP, find the affected server, and click to re-authenticate. Then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- Always include digests — do not omit them.
- Recommend digest pinning in production and automated update tooling (e.g., Renovate, Dependabot) to track Chainguard image updates.
- If version history is not available for the user's org, say so explicitly rather than falling back to the public catalog.
