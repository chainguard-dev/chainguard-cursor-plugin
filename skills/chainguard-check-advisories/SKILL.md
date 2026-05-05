---
name: chainguard-check-advisories
description: Check CVEs and security advisories for a Chainguard image or APK package. Use when the user asks about vulnerabilities, CVEs, or the security status of an image.
---

# Check Chainguard Advisories

**IMPORTANT: You must complete org resolution (Step 1) before querying for any advisories. Do not use `cgr.dev/chainguard` as the org without first confirming the user has no private organizations.**

Use the `cg-api` MCP server to identify the user's organization and query security advisories.

## Steps

1. **Resolve the target organization — do this first, before any advisory lookup.**
   a. If the user has already specified a full image reference (e.g., `cgr.dev/mycompany/nginx:latest`), extract and use that org directly — skip the remaining checks.
   b. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set (non-empty), use that org and proceed to step 2.
   c. If no chainctl default is set, call the `cg-api` MCP server to list all organizations the user has access to.
      - If exactly one org is returned: use it automatically, tell the user which org you're using, and proceed to step 2.
      - If multiple orgs are returned: show a numbered list and **stop. You do not have enough information to decide which org is correct — only the user knows which catalog they want. Do not offer an opinion, do not suggest a "normal" or "typical" choice, do not add any hints or parenthetical examples after the question, do not proceed with any org. Ask only: "Which organization would you like to use?" and wait for their reply.**
      - If no orgs are returned: only then use `cgr.dev/chainguard` and note that the user appears to have no private organizations.
2. Query `cg-api` for advisories associated with the specified image or package within that organization.
3. Report:
   - CVE IDs and severity (Critical / High / Medium / Low)
   - Affected versions
   - Fixed versions (if available)
   - Chainguard's advisory status (e.g., `fixed`, `not_affected`, `under_investigation`)
4. If the user is on an older image tag, use `cg-versions` to compare against the latest and advise an upgrade if it resolves open vulnerabilities.

## Handling auth errors

If any MCP server call returns a 401 or 403 error, the OAuth tokens have expired. Tell the user:
> "Your Chainguard MCP tokens have expired. Run `node /path/to/chainguard-cursor-plugin/proxy/setup.js`, then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- Advisory data is scoped to the authenticated organization. Results may differ from the public advisory feed at images.chainguard.dev/advisories.
- Distinguish between upstream CVEs (affecting the package) and Chainguard's determination of actual exploitability in their build.
- If querying a non-Chainguard image, tell the user that advisory data is only available for Chainguard-managed images.
- Do not fabricate CVE IDs — if the MCP server returns no results, report that explicitly.
