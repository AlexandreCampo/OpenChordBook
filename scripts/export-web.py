#!/usr/bin/env python3
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Copy the standalone web/PWA application into a clean deployment directory."""
import argparse
import shutil
from pathlib import Path
from web_assets import ROOT, public_files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=ROOT / "dist/web")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        parser.error("Choose a new or empty output directory; existing files are never removed.")
    files = public_files()
    for name in files:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    print(f"Exported {len(files)} web assets to {output}; deploy this directory over HTTPS.")


if __name__ == "__main__":
    main()
