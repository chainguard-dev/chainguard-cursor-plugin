---
name: chainguard-libraries-javascript
description: Configure an npm/Node.js project to use Chainguard Libraries for hardened JavaScript packages. Use when the user wants to set up Chainguard Libraries for npm, Yarn, or pnpm, or asks about hardened Node.js packages.
---

# Chainguard Libraries for JavaScript

Chainguard Libraries provides hardened npm packages with reduced CVE exposure. Packages are distributed via a private npm-compatible registry that requires an auth token.

## Step 1: Generate a Libraries Token

```bash
chainctl libraries token javascript
```

Copy the token.

## Step 2: Configure npm

Set the Chainguard registry and auth token for the `@chainguard` scope (or the full registry, depending on your setup):

```bash
# Configure the registry endpoint
npm config set registry https://libraries.cgr.dev/js/

# Set the auth token
npm config set //libraries.cgr.dev/js/:_authToken ${CHAINGUARD_LIBRARIES_JS_TOKEN}
```

Or add a `.npmrc` file to your project root (do NOT commit the token — use an env var):

```ini
registry=https://libraries.cgr.dev/js/
//libraries.cgr.dev/js/:_authToken=${CHAINGUARD_LIBRARIES_JS_TOKEN}
```

Export your token:

```bash
export CHAINGUARD_LIBRARIES_JS_TOKEN=$(chainctl libraries token javascript)
```

## Step 3: Configure Yarn (v1 / Classic)

```bash
yarn config set registry https://libraries.cgr.dev/js/
```

Add to `.yarnrc`:

```
registry "https://libraries.cgr.dev/js/"
//libraries.cgr.dev/js/:_authToken ${CHAINGUARD_LIBRARIES_JS_TOKEN}
```

## Step 4: Configure Yarn (v2+ / Berry) or pnpm

Add to `.yarnrc.yml`:

```yaml
npmRegistryServer: "https://libraries.cgr.dev/js/"
npmAuthToken: "${CHAINGUARD_LIBRARIES_JS_TOKEN}"
```

Add to `.npmrc` for pnpm:

```ini
registry=https://libraries.cgr.dev/js/
//libraries.cgr.dev/js/:_authToken=${CHAINGUARD_LIBRARIES_JS_TOKEN}
```

## Step 5: Verify

```bash
npm install
# or
yarn install
# or
pnpm install
```

## CI/CD Configuration

In GitHub Actions:

```yaml
- name: Set Chainguard Libraries token
  run: echo "CHAINGUARD_LIBRARIES_JS_TOKEN=$(chainctl libraries token javascript)" >> $GITHUB_ENV
```

Or use a pre-configured secret:

```yaml
env:
  CHAINGUARD_LIBRARIES_JS_TOKEN: ${{ secrets.CHAINGUARD_LIBRARIES_JS_TOKEN }}
```

## Notes

- Chainguard Libraries mirrors npm packages with patched dependencies. Package names and APIs are identical — no code changes required.
- Add `.npmrc` to `.gitignore` if it contains literal tokens (prefer env var interpolation instead).
- Packages not yet in Chainguard Libraries will not resolve from this registry — configure a fallback or check with Chainguard for coverage.
- Token refresh: run `chainctl libraries token javascript` when the current token expires.
