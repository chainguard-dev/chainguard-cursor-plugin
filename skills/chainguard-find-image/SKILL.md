---
name: chainguard-find-image
description: Find the right Chainguard container image for a given language, framework, or tool. Use when the user asks which cgr.dev image to use, or wants to replace a Docker Hub base image.
---

# Find Chainguard Image

**IMPORTANT: You must complete org resolution (Step 1) before querying for any images. Do not use `cgr.dev/chainguard` as the org without first confirming the user has no private organizations.**

Use the `cg-api` MCP server to identify the user's Chainguard organization, then use `cg-oci` and `cg-versions` to find and pin the right image.

## Steps

1. **Resolve the target organization — do this first, before any image lookup.**
   a. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set (non-empty), use that org and proceed to step 2.
   b. If no chainctl default is set, call the `cg-api` MCP server to list all organizations the user has access to.
      - If exactly one org is returned: use it automatically, tell the user which org you're using, and proceed to step 2.
      - If multiple orgs are returned: show a numbered list and **stop. You do not have enough information to decide which org is correct — only the user knows which catalog they want. Do not offer an opinion, do not suggest a "normal" or "typical" choice, do not add any hints or parenthetical examples after the question, do not proceed with any org. Ask only: "Which organization would you like to use?" and wait for their reply.**
      - If no orgs are returned: only then use `cgr.dev/chainguard` and note that the user appears to have no private organizations.

2. Query `cg-oci` to search for images matching the user's language, framework, or tool (e.g., `python`, `node`, `go`, `jdk`, `nginx`) within the resolved organization.
3. Use `cg-versions` to confirm the latest tag and whether a `-dev` variant is available.
4. Fetch the current digest for the recommended image via `cg-oci` and include it in the output. **Always provide the digest — do not skip this step.**
5. Present the result and explain the difference between the standard image (minimal, distroless) and the `-dev` variant.

## Example Output

```
Organization: mycompany

cgr.dev/mycompany/python:latest@sha256:abc123...   # minimal, production-ready
cgr.dev/mycompany/python:latest-dev                # includes shell + pip for development
```

## Handling auth errors

If any MCP server call returns a 401 or 403 error, the OAuth tokens have expired. Tell the user:
> "Your Chainguard MCP tokens have expired. Run `node /path/to/chainguard-cursor-plugin/proxy/setup.js`, then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- Always include the digest (`@sha256:...`) in the recommended production reference.
- If the image is not found in the user's org catalog, say so explicitly — do not silently fall back to the public catalog.
- Chainguard images are rebuilt nightly; `:latest` always resolves to the latest patched build.
