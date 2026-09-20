# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Public web files shared by the preview server and deployment exporter."""
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
ENTRY_FILES = (
    "index.html", "sw.js", "manifest.webmanifest", "LICENSE", "COPYRIGHT",
    "THIRD_PARTY_NOTICES.md", "PRIVACY.md", "data/catalog.json",
)
ASSET_DIRS = ("src", "vendor", "icons", "licenses")
ASSET_SUFFIXES = {".js", ".css", ".woff", ".woff2", ".ttf", ".svg", ".png", ".md", ".txt"}


def public_files():
    """Return relative asset paths; reject symlinks outside the source tree."""
    files = set(ENTRY_FILES)
    for folder in ASSET_DIRS:
        files.update(p.relative_to(ROOT).as_posix() for p in (ROOT / folder).rglob("*")
                     if p.is_file() and p.suffix in ASSET_SUFFIXES)
    for name in files:
        path = ROOT / name
        if not path.is_file() or not path.resolve().is_relative_to(ROOT):
            raise ValueError(f"Missing or unsafe public asset: {name}")
    return sorted(files)


class PublicAssetHandler(SimpleHTTPRequestHandler):
    """Expose app files only: no Git metadata, build files or directory listings."""
    public_names = frozenset(public_files())

    def allowed(self):
        name = unquote(urlsplit(self.path).path).removeprefix("/") or "index.html"
        if name not in self.public_names or not (ROOT / name).resolve().is_relative_to(ROOT):
            self.send_error(404)
            return False
        self.path = "/" + name
        return True

    def do_GET(self):
        if self.allowed():
            super().do_GET()

    def do_HEAD(self):
        if self.allowed():
            super().do_HEAD()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
