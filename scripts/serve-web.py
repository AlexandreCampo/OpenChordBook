#!/usr/bin/env python3
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Serve the web app locally without exposing private development files."""
import argparse
from http.server import ThreadingHTTPServer
from web_assets import PublicAssetHandler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), PublicAssetHandler) as server:
        print(f"jazz4all: http://{args.host}:{server.server_port}/ (app assets only)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
