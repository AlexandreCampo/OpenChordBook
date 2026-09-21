#!/usr/bin/env python3
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Run repeatable local checks without using a real browser profile or library."""
import argparse
import os
import subprocess
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from web_assets import ROOT, PublicAssetHandler


def run(*command, env=None):
    print("+ " + " ".join(map(str, command)), flush=True)
    subprocess.run(list(map(str, command)), cwd=ROOT, env=env, check=True)


def browser_checks():
    class QuietHandler(PublicAssetHandler):
        def log_message(self, *_):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        env = {**os.environ, "OPENCHORDBOOK_URL": f"http://127.0.0.1:{server.server_port}"}
        try:
            for test in sorted((ROOT / "tests/browser").glob("*.cjs")):
                run("node", test.relative_to(ROOT), env=env)
        finally:
            server.shutdown()
            thread.join()


def native_checks():
    with tempfile.TemporaryDirectory(prefix="openchordbook-jvm-") as directory:
        source = ROOT / "android/app/src/main/java/io/github/openchordbook"
        run("javac", "--release", "17", "-d", directory, source / "NetworkPolicy.java",
            source / "PlaylistDownloader.java", source / "PlaylistExport.java", ROOT / "tests/native/NativeSecurityTest.java")
        run("java", "-cp", directory, "io.github.openchordbook.NativeSecurityTest")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suites", nargs="*", choices=("unit", "browser", "native", "repository"))
    suites = parser.parse_args().suites or ["repository", "unit", "browser", "native"]
    for suite in suites:
        if suite == "repository":
            run(sys.executable, "tests/tooling.py")
        elif suite == "unit":
            for test in sorted((ROOT / "tests/unit").glob("*.mjs")):
                run("node", test.relative_to(ROOT))
        elif suite == "browser":
            browser_checks()
        elif suite == "native":
            native_checks()
    print("All requested checks passed.")


if __name__ == "__main__":
    try:
        main()
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        raise SystemExit(str(error)) from error
