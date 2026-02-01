#!/usr/bin/env python3
"""
Export Gallery Examples Script

Generates an examples-manifest.json for the doc site from .vw bundle files.
This replaces the need to manually update multiple config files when adding examples.

Usage:
    python scripts/export_gallery_examples.py [OPTIONS]

Options:
    --vw-dir PATH       Directory containing .vw files (default: doc/public/widgets)
    --data-dir PATH     Directory containing data files (default: doc/public/testdata)
    --output PATH       Output manifest path (default: doc/public/examples-manifest.json)
    --verbose           Show detailed output
"""

from __future__ import annotations

import argparse
import json
import hashlib
from pathlib import Path
from typing import Any


def compute_id_from_filename(filename: str) -> str:
    """Generate a URL-safe ID from filename."""
    # Remove extension and version suffix
    name = filename.replace(".vw", "").replace(".js", "")
    # Remove hash suffixes like __0ef429f27d__v1
    parts = name.split("__")
    if len(parts) >= 2:
        name = parts[0]
    # Convert to kebab-case
    return name.replace("_", "-").lower()[:50]


def extract_vw_metadata(vw_path: Path) -> dict[str, Any] | None:
    """Extract metadata from a .vw bundle file."""
    try:
        with open(vw_path, "r", encoding="utf-8") as f:
            bundle = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"  Warning: Failed to parse {vw_path.name}: {e}")
        return None

    code = bundle.get("code", "")
    if not code:
        print(f"  Warning: {vw_path.name} has no code")
        return None

    # Extract gallery metadata if present
    gallery = bundle.get("gallery", {})
    
    # Build metadata
    metadata = {
        "id": gallery.get("id") or compute_id_from_filename(vw_path.name),
        "label": gallery.get("label") or bundle.get("description", vw_path.stem)[:60],
        "prompt": bundle.get("description", ""),
        "description": gallery.get("description") or bundle.get("description", ""),
        "vwUrl": f"/widgets/{vw_path.name}",
        "categories": gallery.get("categories", ["Featured"]),
        "size": gallery.get("size", "medium"),
        "gifUrl": gallery.get("gifUrl", ""),
        # Metadata from bundle
        "outputs": bundle.get("outputs", {}),
        "inputs": bundle.get("inputs_signature", {}),
        "hasEmbeddedData": bool(bundle.get("save_inputs", {}).get("embedded")),
    }
    
    # If data is not embedded, check for dataUrl in gallery config
    if not metadata["hasEmbeddedData"]:
        metadata["dataUrl"] = gallery.get("dataUrl", "")
        metadata["dataType"] = gallery.get("dataType", "csv")
    
    return metadata


def scan_vw_directory(vw_dir: Path, verbose: bool = False) -> list[dict[str, Any]]:
    """Scan directory for .vw files and extract metadata."""
    examples = []
    
    if not vw_dir.exists():
        print(f"Warning: Widget directory {vw_dir} does not exist")
        return examples
    
    vw_files = sorted(vw_dir.glob("*.vw"))
    if verbose:
        print(f"Found {len(vw_files)} .vw files in {vw_dir}")
    
    for vw_path in vw_files:
        if verbose:
            print(f"  Processing: {vw_path.name}")
        
        metadata = extract_vw_metadata(vw_path)
        if metadata:
            examples.append(metadata)
    
    return examples


def generate_manifest(
    examples: list[dict[str, Any]],
    output_path: Path,
    verbose: bool = False
) -> None:
    """Generate the examples-manifest.json file."""
    manifest = {
        "$schema": "./examples-manifest.schema.json",
        "version": "1.0",
        "generated": True,
        "examples": examples,
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    
    if verbose:
        print(f"\nGenerated manifest with {len(examples)} examples")
        print(f"Output: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate examples-manifest.json from .vw bundle files"
    )
    parser.add_argument(
        "--vw-dir",
        type=Path,
        default=Path("doc/public/widgets"),
        help="Directory containing .vw files",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("doc/public/testdata"),
        help="Directory containing data files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("doc/public/examples-manifest.json"),
        help="Output manifest path",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output",
    )
    
    args = parser.parse_args()
    
    # Resolve paths relative to repo root
    repo_root = Path(__file__).parent.parent
    vw_dir = repo_root / args.vw_dir
    output_path = repo_root / args.output
    
    if args.verbose:
        print(f"Scanning: {vw_dir}")
    
    examples = scan_vw_directory(vw_dir, args.verbose)
    
    if not examples:
        print("No .vw bundles found. Creating empty manifest.")
        print("To add examples, place .vw files in doc/public/widgets/")
        print("Or use widget.save('path/to/widget.vw') in a notebook.")
    
    generate_manifest(examples, output_path, args.verbose)
    
    print(f"✓ Manifest generated: {output_path}")
    print(f"  Examples: {len(examples)}")


if __name__ == "__main__":
    main()
