#!/usr/bin/env python3
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Export committed source and build files without Git history or local state."""
import argparse
import gzip
import io
import subprocess
import tarfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path, help='New .tar.gz output file, normally under dist/')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
if subprocess.check_output(['git', 'status', '--porcelain'], cwd=root).strip():
    raise SystemExit('Commit the release changes first; this export uses only a clean HEAD.')
archive = subprocess.check_output(['git', 'archive', '--format=tar', '--prefix=jazz4all/', 'HEAD'], cwd=root)
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    for member in tar.getmembers():
        path = Path(member.name)
        if path.suffix in ('.p12', '.jks', '.keystore', '.apk') or path.name in ('config.yml', 'config.local.yml', 'keystore.properties', 'local.properties') or any(part in ('.git', '.playwright-mcp', '.codex', '.agents') for part in path.parts):
            raise SystemExit(f'Refusing to export private/generated path: {member.name}')
args.output.parent.mkdir(parents=True, exist_ok=True)
if args.output.exists():
    raise SystemExit('Output exists; choose a new archive filename.')
with args.output.open('wb') as out:
    with gzip.GzipFile(filename='', fileobj=out, mode='wb', mtime=0) as compressed:
        compressed.write(archive)
print(f'Exported clean source to {args.output}. No Git history or ignored files included.')
