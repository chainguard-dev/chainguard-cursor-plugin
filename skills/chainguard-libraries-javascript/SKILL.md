---
name: chainguard-libraries-javascript
description: Configure an npm/Node.js project to use Chainguard Libraries for JavaScript packages built from source. Use when the user wants to set up Chainguard Libraries for npm, Yarn, or pnpm, or asks about the provenance of Node.js packages.
---

# Chainguard Libraries for JavaScript

Chainguard Libraries for JavaScript gives a project one trusted npm-compatible endpoint, `https://libraries.cgr.dev/javascript/`. Packages served from it are rebuilt by Chainguard from verifiable source, with SLSA provenance and SPDX SBOMs. When upstream fallback is enabled for the organization, packages Chainguard hasn't built are proxied from the npm Registry through `https://libraries.cgr.dev/javascript-upstream/`, after malware scanning and a configurable cooldown for newly published versions (7 days by default). All packages are subject to your organization's policies.

Chainguard rebuilds the same upstream versions; it does not patch CVEs in JavaScript packages. Don't describe these packages as patched or as having fewer CVEs.

Package names, versions, and APIs are unchanged. Only registry configuration and lockfile hashes change.

## Step 1: Pick the organization

```bash
chainctl iam organizations list
```

If the user belongs to more than one organization, ask which one to use and pass `--parent=<org>` to every command below that accepts it (`auth pull-token`, `auth configure npm --pull-token`, `libraries update-hashes`, `libraries verify`).

## Step 2: Configure the registry

Always point the registry at `/javascript/`, never at `/javascript-upstream/`; fallback packages come through the same endpoint.

### npm

Write a project-level `.npmrc` from the current Chainguard session:

```bash
chainctl auth configure npm
```

For CI or other non-interactive environments, use a pull token instead:

```bash
chainctl auth configure npm --pull-token [--parent=<org>] [--ttl=24h]
```

Session-backed tokens expire; re-run the command when they do. `--ttl` accepts up to `8760h`. (The CLI also accepts the top-level `chainctl auth configure-npm`, which the Academy docs use; prefer `configure npm`.)

### pnpm and Yarn: export pull-token credentials first

Don't use `chainctl auth configure npm` for pnpm or Yarn: it writes path-scoped credentials that don't cover the `/javascript-upstream/` fallback path, so fallback packages fail with HTTP 401. Configure them manually, starting from a pull token:

```bash
eval $(chainctl auth pull-token --output env --repository=javascript [--parent=<org>])
```

This sets `CHAINGUARD_JAVASCRIPT_IDENTITY_ID` and `CHAINGUARD_JAVASCRIPT_TOKEN` (default expiry 30 days; set `--ttl` to change it).

### pnpm (v11 or newer recommended)

Key the credential to the whole host so it covers the fallback path:

```bash
export token=$(echo -n "${CHAINGUARD_JAVASCRIPT_IDENTITY_ID}:${CHAINGUARD_JAVASCRIPT_TOKEN}" | base64 -w 0)

pnpm config set registry https://libraries.cgr.dev/javascript/ --location=project
pnpm config set //libraries.cgr.dev/:_auth "${token}" --location=project
```

### Yarn Berry (2.x+)

```bash
export authInfo="${CHAINGUARD_JAVASCRIPT_IDENTITY_ID}:${CHAINGUARD_JAVASCRIPT_TOKEN}"

yarn config set npmRegistryServer https://libraries.cgr.dev/javascript
yarn config set 'npmRegistries["//libraries.cgr.dev/javascript"].npmAuthIdent' "${authInfo}"
yarn config set 'npmRegistries["//libraries.cgr.dev/javascript"].npmAlwaysAuth' "true"
```

### Yarn Classic (1.x)

Yarn Classic reads credentials from `.npmrc`, not `.yarnrc`. Cover both paths:

```bash
export token=$(echo -n "${CHAINGUARD_JAVASCRIPT_IDENTITY_ID}:${CHAINGUARD_JAVASCRIPT_TOKEN}" | base64 -w 0)
cat > .npmrc << EOF
registry=https://libraries.cgr.dev/javascript/
//libraries.cgr.dev/javascript/:_auth="$token"
//libraries.cgr.dev/javascript/:always-auth=true
//libraries.cgr.dev/javascript-upstream/:_auth="$token"
//libraries.cgr.dev/javascript-upstream/:always-auth=true
EOF
```

The trailing slashes are required. Check the result with `npm ping --userconfig .npmrc` (expect `PONG`).

## Step 3: Keep credentials out of git

Every method above writes a real credential to disk. Never write a literal token into a committed file. For each file that now holds one (`.npmrc`, `.yarnrc.yml`):

```bash
git check-ignore .npmrc
```

If it prints nothing, the file isn't ignored: add it to `.gitignore` before doing anything else. If the file is already tracked, tell the user and don't commit it. In CI, supply credentials from secrets or an assumable identity at build time.

## Step 4: Update the lockfile

Changing the registry is not enough. A plain install keeps the existing lockfile's `registry.npmjs.org` URLs and checksums, and Chainguard's rebuilt tarballs have different hashes. **Ask the user which option they want before deleting anything:**

1. **Keep pinned versions (recommended).** Update hashes in place, then run the reinstall command `update-hashes` prints in its "Next steps" section:

   ```bash
   rm -rf node_modules
   chainctl libraries update-hashes [--parent=<org>]
   # then the reinstall command from "Next steps", e.g. npm install
   ```

   If the install then fails with integrity errors, re-run `update-hashes --replace`. If `update-hashes` fails listing packages that need a fallback URL, report them. Don't pass `--fallback-registry-url` pointing at the public npm registry.

2. **Refresh versions.** Regenerate the lockfile. This re-resolves `^`/`~` ranges, so pinned versions can change, and versions still inside the cooldown window are refused.

   | Tool | Command |
   | --- | --- |
   | npm | `rm -rf node_modules package-lock.json && npm install` |
   | pnpm | `rm -rf node_modules pnpm-lock.yaml && pnpm install` |
   | Yarn Berry | `rm -rf .yarn/cache yarn.lock && yarn` |
   | Yarn Classic | `rm -rf node_modules yarn.lock && yarn` |

If the install serves stale data, clear the cache (`npm cache clean --force`, `yarn cache clean`, or the pnpm steps in the migration guide).

## Step 5: Check where packages come from

Count the resolved hosts in the lockfile (`resolved` in `package-lock.json` and `yarn.lock`, `archiveUrl` in Yarn Berry, `tarball` in older `pnpm-lock.yaml`):

```bash
LOCK=package-lock.json   # or yarn.lock, pnpm-lock.yaml
for p in libraries.cgr.dev/javascript/ libraries.cgr.dev/javascript-upstream/ registry.npmjs.org/ registry.yarnpkg.com/; do
  printf '%6s  %s\n' "$(grep -o "https://$p" "$LOCK" | wc -l)" "$p"
done
```

Report the counts for:
- `libraries.cgr.dev/javascript/`: built by Chainguard
- `libraries.cgr.dev/javascript-upstream/`: served through upstream fallback

If any entry still resolves from `registry.npmjs.org` (or `registry.yarnpkg.com`), **stop** and tell the user: "N packages still resolve from the public npm registry, so the migration is incomplete. Re-run Step 4." The only exception is scoped packages the user deliberately routes elsewhere with `@scope:registry=` in `.npmrc`.

pnpm v9+ lockfiles usually record no tarball URLs; rely on Step 6 instead.

## Step 6: Verify provenance

```bash
chainctl libraries verify [--parent=<org>] package-lock.json
# or pnpm-lock.yaml, yarn.lock, or ./node_modules
```

Use `-o json --detailed` for per-entry results. Report how many packages are verified as Chainguard-built and how many came through fallback.

Don't report or optimize for the "Verification Coverage" percentage, and never set 100% as a goal. Fallback packages and unused platform-specific binaries will never verify, and that's expected. The command is informational, and its exit status doesn't reflect coverage.

Offer to save SBOMs and provenance:

```bash
chainctl libraries verify package-lock.json --output-attestations --output-dir ./attestations
```

## Step 7 (optional, only if the user asks): Audit

1. Run `npm audit`.
2. Apply only the fixes that don't need `--force` (`npm audit fix`).
3. For the rest, propose upgrading to the lowest patched version in the same major version; list anything that needs a major bump for a human to decide.
4. If a fixed version is refused by the cooldown (HTTP 403), report the package and version. Never fall back to the public npm registry or bypass the policy to get it.
5. Re-run Steps 5 and 6 after any change.

## CI/CD

Prefer an assumable identity over a static token:

```yaml
steps:
  - uses: chainguard-dev/setup-chainctl@main
    with:
      identity: "<identity-id>"
  - run: chainctl auth configure npm
```

For pnpm and Yarn, authenticate the workload, then apply the tool-specific configuration from Step 2. If the platform doesn't support assumable identities, store the pull token as a CI secret.

## Notes

- If packages Chainguard hasn't built return 404, upstream fallback may not be enabled for the organization. The migration guide enables it with `chainctl libraries entitlements create --ecosystems=JAVASCRIPT --policy=CHAINGUARD_AND_UPSTREAM`; policy changes can take up to 30 minutes. Ask before changing org settings.
- pnpm v11: if `--frozen-lockfile` fails on an up-to-date lockfile, set `trustLockfile: true` in `pnpm-workspace.yaml`. If `trustPolicy: no-downgrade` blocks rebuilt packages, set `trustPolicy: off`.
- Repository managers (Artifactory, Nexus, Cloudsmith): use a single upstream pointed at `https://libraries.cgr.dev/javascript/` and pass `--registry-url` to `update-hashes`. Don't add a separate public npm remote; it bypasses Chainguard's controls.
- Docs: [overview](https://edu.chainguard.dev/chainguard/libraries/javascript/overview/), [build configuration](https://edu.chainguard.dev/chainguard/libraries/javascript/build-configuration/), [global configuration](https://edu.chainguard.dev/chainguard/libraries/javascript/global-configuration/), [migration](https://edu.chainguard.dev/chainguard/libraries/javascript/migration/).
