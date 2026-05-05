# Chainguard for Cursor

Bring Chainguard's secure container images and hardened library dependencies into your Cursor AI workflow. Query images, check security advisories, inspect SBOMs, migrate Dockerfiles, and configure Chainguard Libraries for Java, JavaScript, and Python — all from the agent chat.

## What's included

### Skills

Invoke with `/` in the agent chat:

| Skill | What it does |
|---|---|
| `/chainguard-find-image` | Find the right `cgr.dev` image for your language, framework, or tool |
| `/chainguard-inspect-image` | List packages, SBOM summary, entrypoint, and config for an image |
| `/chainguard-check-advisories` | Query CVEs and security advisories for an image or APK package |
| `/chainguard-compare-versions` | Show version history, changelogs, and digests across image tags |
| `/chainguard-migrate-dockerfile` | Rewrite a Dockerfile to use Chainguard base images |
| `/chainguard-libraries-java` | Configure Maven or Gradle to use Chainguard Libraries |
| `/chainguard-libraries-javascript` | Configure npm, Yarn, or pnpm to use Chainguard Libraries |
| `/chainguard-libraries-python` | Configure pip, uv, or Poetry to use Chainguard Libraries |
| `/chainguard-setup-auth` | Verify and set up Chainguard authentication via `chainctl` |

### Rules

Applied automatically based on the file you're editing:

| Rule | Activates on |
|---|---|
| Prefer Chainguard Images | `Dockerfile`, `docker-compose.yml` |
| Chainguard Libraries — Java | `pom.xml`, `build.gradle`, `*.gradle.kts` |
| Chainguard Libraries — JavaScript | `package.json`, `.npmrc`, `.yarnrc*` |
| Chainguard Libraries — Python | `requirements*.txt`, `pyproject.toml`, `Pipfile` |
| Supply Chain Policy | GitHub Actions workflows |

### MCP Servers

The skills above use four Chainguard MCP servers for live data:

| Server | Endpoint | Provides |
|---|---|---|
| `cg-oci` | `cgr.dev/mcp` | Image lookup, tags, digests |
| `cg-apk` | `apk.cgr.dev/mcp` | APK package queries |
| `cg-versions` | `versions.cgr.dev/mcp` | Version history and changelogs |
| `cg-api` | `console-api.enforce.dev/mcp` | Policies, advisories, org context |

## Requirements

- [Cursor](https://cursor.com)
- [Node.js](https://nodejs.org) 18 or later (required for MCP authentication)
- A Chainguard account — [sign up free at chainguard.dev](https://chainguard.dev)

## MCP Server Setup

The MCP servers use OAuth 2.0 (PKCE) for authentication. A one-time setup is required before Cursor can connect to them.

### 1. Install proxy dependencies

```bash
cd /path/to/chainguard-cursor-plugin/proxy
npm install
```

### 2. Configure Cursor's MCP servers

Add the following to `~/.cursor/mcp.json` (create it if it doesn't exist), replacing `/path/to/chainguard-cursor-plugin` with the actual path:

```json
{
  "mcpServers": {
    "cg-api": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/chainguard-cursor-plugin/proxy/proxy.js", "https://console-api.enforce.dev/mcp"]
    },
    "cg-apk": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/chainguard-cursor-plugin/proxy/proxy.js", "https://apk.cgr.dev/mcp"]
    },
    "cg-oci": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/chainguard-cursor-plugin/proxy/proxy.js", "https://cgr.dev/mcp"]
    },
    "cg-versions": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/chainguard-cursor-plugin/proxy/proxy.js", "https://versions.cgr.dev/mcp"]
    }
  }
}
```

### 3. Authenticate

Run the setup script once to authenticate all four servers. It opens one browser tab at a time and caches the tokens locally:

```bash
node /path/to/chainguard-cursor-plugin/proxy/setup.js
```

Tokens are valid for approximately one hour. Re-run this script when they expire (Cursor's MCP panel will show a connection error when that happens).

### 4. Restart Cursor

Once authenticated, restart Cursor. The four MCP servers will appear as connected in **Settings → MCP**.

## Chainguard Libraries

Chainguard Libraries provides hardened, continuously-patched builds of popular open source packages for Java (Maven/Gradle), JavaScript (npm/Yarn/pnpm), and Python (pip/uv/Poetry).

Use the `/chainguard-libraries-java`, `/chainguard-libraries-javascript`, or `/chainguard-libraries-python` skills to configure your project. Each will walk you through obtaining a registry token and updating your package manager configuration.

You'll need a Chainguard Libraries subscription — contact [chainguard.dev](https://chainguard.dev) for access.

## Usage examples

### Find an image

```
/chainguard-find-image — find me a Python 3.12 image for production
```

> Resolves your organization, queries the catalog, and returns a digest-pinned reference:
> ```
> cgr.dev/mycompany/python:latest@sha256:a1b2c3...   # minimal, distroless runtime
> cgr.dev/mycompany/python:latest-dev                # includes shell + pip for builds
> ```

---

### Inspect an image

```
/chainguard-inspect-image — what packages are in cgr.dev/mycompany/nginx:latest?
```

> Lists all APK packages, the entrypoint, architecture, and whether the image runs as non-root.

---

### Check for CVEs

```
/chainguard-check-advisories — are there any open CVEs in cgr.dev/mycompany/go:latest?
```

> Returns CVE IDs, severity, affected versions, and Chainguard's advisory status (`fixed`, `not_affected`, etc.). Reports explicitly if none are found.

---

### Compare versions

```
/chainguard-compare-versions — what changed between the last two releases of cgr.dev/mycompany/node?
```

> Shows a changelog with package version bumps, CVE fixes, and the `sha256` digest for each release so you can pin to a known-good version.

---

### Migrate a Dockerfile

```
/chainguard-migrate-dockerfile — harden this Dockerfile:

FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]
```

> Rewrites the Dockerfile using a multi-stage build: `-dev` variant for the build stage, minimal distroless runtime for the final stage, pinned to the current digest.

---

### Set up Chainguard Libraries — Java

```
/chainguard-libraries-java — configure our Maven project to pull from Chainguard Libraries
```

> Walks through adding the Chainguard Maven registry to `settings.xml` and the token configuration for authenticated pulls.

---

### Set up Chainguard Libraries — JavaScript

```
/chainguard-libraries-javascript — we use pnpm. Set up Chainguard Libraries as our npm registry.
```

> Produces the `.npmrc` configuration with the Chainguard registry URL and auth token setup for pnpm workspaces.

---

### Set up Chainguard Libraries — Python

```
/chainguard-libraries-python — configure uv to use Chainguard Libraries as our PyPI index
```

> Updates `pyproject.toml` or `uv.toml` to point to the Chainguard Python registry with token-based authentication.

---

### Check authentication

```
/chainguard-setup-auth — I'm on a new machine, walk me through getting set up
```

> Checks for `chainctl`, runs `chainctl auth login` if needed, and confirms access with `chainctl iam organizations list`.

## License

Apache 2.0 — see [LICENSE](LICENSE).
