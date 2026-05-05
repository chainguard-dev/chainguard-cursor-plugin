---
name: chainguard-libraries-python
description: Configure a Python project to use Chainguard Libraries for hardened PyPI packages. Use when the user wants to set up Chainguard Libraries for pip, uv, or Poetry, or asks about hardened Python packages.
---

# Chainguard Libraries for Python

Chainguard Libraries provides hardened Python packages with reduced CVE exposure. Packages are distributed via a private PyPI-compatible index that requires an auth token.

## Step 1: Generate a Libraries Token

```bash
chainctl libraries token python
```

Copy the token.

## Step 2: Configure pip

Set the Chainguard index URL, passing the token as the password:

```bash
pip install \
  --index-url https://user:${CHAINGUARD_LIBRARIES_PYTHON_TOKEN}@libraries.cgr.dev/python/simple/ \
  <package>
```

Or add to `pip.conf` (`~/.config/pip/pip.conf` on Linux, `~/Library/Application Support/pip/pip.conf` on macOS):

```ini
[global]
index-url = https://libraries.cgr.dev/python/simple/
extra-index-url = https://pypi.org/simple/
```

For authentication, set the token as an environment variable and reference it:

```bash
export CHAINGUARD_LIBRARIES_PYTHON_TOKEN=$(chainctl libraries token python)
export PIP_INDEX_URL=https://user:${CHAINGUARD_LIBRARIES_PYTHON_TOKEN}@libraries.cgr.dev/python/simple/
```

## Step 3: Configure pyproject.toml (PEP 691 / uv)

For `uv`:

```toml
[tool.uv.sources]
# Use Chainguard index as primary, PyPI as fallback
[[tool.uv.index]]
url = "https://libraries.cgr.dev/python/simple/"
default = true

[[tool.uv.index]]
url = "https://pypi.org/simple/"
```

Set auth via environment:

```bash
export UV_INDEX_URL=https://user:${CHAINGUARD_LIBRARIES_PYTHON_TOKEN}@libraries.cgr.dev/python/simple/
```

## Step 4: Configure Poetry

```toml
# pyproject.toml
[[tool.poetry.source]]
name = "chainguard"
url = "https://libraries.cgr.dev/python/simple/"
priority = "primary"
```

Add credentials:

```bash
poetry config http-basic.chainguard user ${CHAINGUARD_LIBRARIES_PYTHON_TOKEN}
```

## Step 5: Verify

```bash
pip install requests   # should resolve from Chainguard Libraries
# or
uv pip install requests
# or
poetry install
```

## CI/CD Configuration

In GitHub Actions:

```yaml
- name: Set Chainguard Libraries token
  run: echo "CHAINGUARD_LIBRARIES_PYTHON_TOKEN=$(chainctl libraries token python)" >> $GITHUB_ENV

- name: Install dependencies
  run: pip install -r requirements.txt
  env:
    PIP_INDEX_URL: https://user:${{ env.CHAINGUARD_LIBRARIES_PYTHON_TOKEN }}@libraries.cgr.dev/python/simple/
```

## Notes

- Chainguard Libraries mirrors PyPI packages with patched transitive dependencies. Package names and import paths are identical.
- Avoid hardcoding tokens in `pip.conf` or `pyproject.toml` — always use environment variable interpolation.
- Configure `extra-index-url` pointing to PyPI as a fallback for packages not yet in Chainguard Libraries.
- Token refresh: run `chainctl libraries token python` when the current token expires.
