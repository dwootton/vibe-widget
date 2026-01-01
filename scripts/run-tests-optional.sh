#!/usr/bin/env bash
set -euo pipefail

pytest
RUN_PERF=1 pytest -m performance
RUN_E2E=1 pytest -m e2e
