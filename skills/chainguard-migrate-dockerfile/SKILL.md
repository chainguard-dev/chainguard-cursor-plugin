---
name: chainguard-migrate-dockerfile
description: Migrate an existing Dockerfile to use a Chainguard base image. Use when the user wants to harden a Dockerfile, replace a Docker Hub base image, or apply a multi-stage build pattern with cgr.dev images.
---

# Migrate Dockerfile to Chainguard

Read the user's Dockerfile, identify the base image, find the Chainguard equivalent scoped to the user's organization, and produce a hardened replacement.

## Steps

1. Read the Dockerfile (ask the user to share it if not already visible).
2. Identify the `FROM` instruction(s) and note the current base image (e.g., `python:3.12-slim`, `node:20-alpine`).
3. **Resolve the target organization — do this before any image lookup.**
   a. Run `chainctl config view` and check `default.group` and `default.org-name`. If either is set (non-empty), use that org and proceed to step 4.
   b. If no chainctl default is set, call the `cg-api` MCP server to list all organizations the user has access to.
      - If exactly one org is returned: use it automatically, tell the user which org you're using, and proceed to step 4.
      - If multiple orgs are returned: show a numbered list and **stop. You do not have enough information to decide which org is correct — only the user knows which catalog they want. Do not offer an opinion, do not suggest a "normal" or "typical" choice, do not add any hints or parenthetical examples after the question, do not proceed with any org. Ask only: "Which organization would you like to use?" and wait for their reply.**
      - If no orgs are returned: only then use `cgr.dev/chainguard` and note that the user appears to have no private organizations.
   Use the resolved org slug in all image references: `cgr.dev/<org-slug>/<image>`. Do not use `cgr.dev/chainguard` without first completing this step.
4. Query `cg-oci` to find the matching Chainguard image within the user's organization.
5. Fetch the current digest for the runtime image via `cg-oci` and pin to it in the final `FROM`.
6. Rewrite the Dockerfile applying these best practices:
   - Replace `FROM` with `cgr.dev/<org>/<image>:latest@sha256:<digest>`
   - Use a multi-stage build: `-dev` variant for the build stage, minimal variant for runtime
   - Remove `apt-get install` / `apk add` from the runtime stage
   - Ensure the final stage runs as `nonroot` user (UID 65532)
   - Use `COPY --chown=nonroot:nonroot` for file ownership
7. Show a diff of the changes and explain each one.

## Multi-Stage Pattern

```dockerfile
# Build stage — use -dev variant which includes shell, package manager, compilers
FROM cgr.dev/<org>/python:latest-dev AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target /app/deps

# Runtime stage — minimal, distroless, no shell, digest-pinned
FROM cgr.dev/<org>/python:latest@sha256:<digest>
WORKDIR /app
COPY --from=builder /app/deps /app/deps
COPY --chown=nonroot:nonroot src/ .
ENV PYTHONPATH=/app/deps
ENTRYPOINT ["python", "main.py"]
```

## Handling auth errors

If any MCP server call returns a 401 or 403 error, the OAuth tokens have expired. Tell the user:
> "Your Chainguard MCP tokens have expired. Run `node /path/to/chainguard-cursor-plugin/proxy/setup.js`, then open a new agent session and try again."
Do not attempt to fall back to `chainctl auth token` or direct registry calls — those use a different credential type and will also fail.

## Notes

- Always pin the runtime stage to a digest for reproducibility.
- If the image is not available in the user's organization catalog, say so — do not silently substitute the public catalog image.
- If the Dockerfile installs OS packages in the runtime stage, suggest moving them to the build stage or contacting Chainguard to add the package to the base image.
- For distroless images, `CMD ["/bin/sh"]` will fail — guide the user to exec-form `ENTRYPOINT`.
