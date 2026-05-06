---
name: chainguard-inspect-image
description: Inspect a Chainguard image's packages, SBOM, entrypoint, and configuration. Use when the user wants to know what is inside a cgr.dev image or needs an SBOM summary.
---

# Inspect Chainguard Image

**IMPORTANT: You must complete org resolution (Step 1) before querying for any images. Do not use `cgr.dev/chainguard` as the org without first confirming the user has no private organizations.**

Use the `cg-api` MCP server to identify the user's organization, then `cg-oci` and `cg-apk` to inspect image contents.

## Steps

1. **Resolve the target organization — do this first, before any image lookup.**
   a. If the user has already specified a full image reference (e.g., `cgr.dev/mycompany/nginx:latest`), extract and use that org directly — skip the remaining checks.
   b. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set (non-empty), use that org and proceed to step 2.
   c. If no chainctl default is set, call the `cg-api` MCP server to list all organizations the user has access to.
      - If exactly one org is returned: use it automatically, tell the user which org you're using, and proceed to step 2.
      - If multiple orgs are returned: **display them as a numbered list**, then ask: "Which organization would you like to use?" and stop. Do not offer an opinion, do not suggest a "normal" or "typical" choice, do not add hints or parenthetical examples, do not proceed until the user replies.
      - If no orgs are returned: only then use `cgr.dev/chainguard` and note that the user appears to have no private organizations.
2. Query `cg-oci` to fetch image metadata: architecture, OS, entrypoint, exposed ports, labels, and current digest.
3. Query `cg-apk` to list the APK packages included in the image (name, version, origin).
4. Present the SBOM summary in a readable table format.
5. Highlight:
   - Whether the image runs as non-root
   - Whether it includes a shell (or is fully distroless)
   - The total package count
   - The current digest

## Example Output

```
Image: cgr.dev/mycompany/nginx:latest
Digest: sha256:abc123...
Architecture: linux/amd64, linux/arm64
User: nonroot (65532)
Shell: none (distroless)

Packages (12 total):
  nginx          1.25.4
  openssl        3.2.1
  ca-certificates 20240101
  ...
```

## Handling auth errors

If any MCP server call returns a 401 or 403 error, the OAuth tokens have expired. Tell the user:
> "Your Chainguard MCP session has expired. In Cursor, go to Settings → MCP, find the affected server, and click to re-authenticate. Then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- If the user needs a shell for debugging, recommend the `-dev` variant temporarily — never in production.
- Fewer packages means a smaller attack surface. Note the package count relative to comparable upstream images where relevant.
