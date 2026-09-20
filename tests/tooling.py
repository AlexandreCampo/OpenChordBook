"""Check publication boundaries and repository references without touching user data."""
import json
import re
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from web_assets import PublicAssetHandler, public_files


class RepositoryTests(unittest.TestCase):
    def test_export_includes_offline_assets_and_excludes_development_files(self):
        with tempfile.TemporaryDirectory(prefix="jazz4all-web-") as directory:
            output = Path(directory) / "public"
            subprocess.run([sys.executable, str(ROOT / "scripts/export-web.py"), str(output)], check=True)
            actual = {p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
            self.assertEqual(actual, set(public_files()))
            cached = re.findall(r"'\./([^']*)'", (ROOT / "sw.js").read_text())
            for name in cached:
                if name:
                    self.assertIn(name, actual, f"Offline cache asset missing: {name}")
            for prefix in (".git", "android", "tests", "scripts", "packaging", ".github", "node_modules"):
                self.assertFalse(any(name.startswith(prefix + "/") for name in actual))
            self.assertNotIn("vendor/package.json", actual)
            self.assertFalse(json.loads((output / "manifest.webmanifest").read_text()).get("share_target"),
                             "Do not advertise a Share Target without its POST handler")
            for name in actual:
                self.assertEqual((output / name).read_bytes(), (ROOT / name).read_bytes())
            # A second export must not overwrite existing contents.
            marker = output / "keep.txt"
            marker.write_text("keep")
            result = subprocess.run([sys.executable, str(ROOT / "scripts/export-web.py"), str(output)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(marker.read_text(), "keep")

    def test_preview_blocks_private_paths_and_sends_real_content(self):
        class QuietHandler(PublicAssetHandler):
            def log_message(self, *_):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                with urlopen(base + "/", timeout=5) as response:
                    self.assertEqual(response.read(), (ROOT / "index.html").read_bytes())
                for path in ("/.git/config", "/android/keystore.properties", "/src/", "/package.json",
                             "/src/../android/keystore.properties", "/src/%2e%2e/android/keystore.properties"):
                    with self.assertRaises(HTTPError) as raised:
                        urlopen(base + path, timeout=5)
                    self.assertEqual(raised.exception.code, 404)
                    raised.exception.close()
            finally:
                server.shutdown()
                thread.join()

    def test_local_documentation_links(self):
        documents = [*ROOT.glob("*.md"), *ROOT.joinpath("docs").rglob("*.md"),
                     ROOT / "android/README.md", ROOT / "tests/README.md",
                     ROOT / "packaging/fdroid/README.md"]
        for document in documents:
            for target in re.findall(r"\]\(([^)]+)\)", document.read_text()):
                url = urlsplit(target)
                if url.scheme or target.startswith("#") or not url.path:
                    continue
                path = (document.parent / unquote(url.path)).resolve()
                self.assertTrue(path.is_relative_to(ROOT) and path.exists(), f"{document.name}: broken link {target}")


if __name__ == "__main__":
    unittest.main()
