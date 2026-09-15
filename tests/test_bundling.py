"""Bundling falls back to the browser path instead of installing packages."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from vibe_widget.services import bundling


def test_unknown_bare_package_skips_the_bundler(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    node_modules = tmp_path / "node_modules"
    (node_modules / "esbuild").mkdir(parents=True)
    monkeypatch.setattr(bundling.shutil, "which", lambda name: f"/usr/bin/{name}")

    def _no_subprocess(*args: object, **kwargs: object) -> object:
        raise AssertionError("bundling must not shell out for an unresolvable package")

    monkeypatch.setattr(subprocess, "run", _no_subprocess)

    service = bundling.BundleService(store_dir=tmp_path)
    monkeypatch.setattr(service, "_node_path", str(node_modules))

    result = service.bundle("import confetti from 'canvas-confetti';\nexport default confetti;")

    assert result.bundled is False
    assert result.error == "bundler_unavailable"
    assert result.code.startswith("import confetti")
