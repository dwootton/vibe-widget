# Contributing

## Setup

```bash
python -m pip install -e ".[dev]"
npm install
```

`npm install` is only needed if you touch the frontend or want server-side bundling.

## Build the widget bundle

The Python package ships a single prebuilt JavaScript bundle. Rebuild it after any change
under `src/vibe_widget/AppWrapper/`:

```bash
npm run build-app-wrapper
```

Restart the Jupyter kernel afterwards; the bundle is read once at import time.

## Test and lint

```bash
pytest tests --no-cov -q
ruff check
```

Tests must not reach the network. `tests/conftest.py` sets a dummy API key and blocks
`requests` and the OpenAI client, so add a mock rather than a live call.

`DEV_SETUP.md` covers the optional integration, performance, and end-to-end suites.

## Pull requests

- One change per pull request, with a title that says what changed.
- Every bug fix comes with a test that fails without the fix.
- New and changed function signatures carry type hints. The package supports Python 3.9, so
  keep runtime syntax compatible with it.
- Update `CHANGELOG.md` under `## [Unreleased]`.
- CI runs ruff and pytest on Python 3.9 and 3.12. Green before review, please.

## Reporting security issues

See `SECURITY.md`. Do not file a public issue for a vulnerability.
