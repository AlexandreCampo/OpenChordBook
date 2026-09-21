"""Inspect the signed artifact, not just the manifest source. Requires Android build tools."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('apk', nargs='?', default='android/app/build/outputs/apk/release/app-release.apk')
parser.add_argument('--unsigned', action='store_true', help='Inspect an unsigned source-build APK; skip signature verification')
args = parser.parse_args()
apk = Path(args.apk).resolve()
root = Path(__file__).resolve().parents[2]
sdk = Path(os.environ.get('ANDROID_SDK_ROOT', os.environ.get('ANDROID_HOME', str(Path.home() / 'Android/Sdk'))))
build_tools = sorted((sdk / 'build-tools').iterdir(), key=lambda p: [int(n) for n in re.findall(r'\d+', p.name)])[-1]
def aapt(*args): return subprocess.check_output([str(build_tools / 'aapt'), *args], text=True)
manifest = aapt('dump', 'xmltree', str(apk), 'AndroidManifest.xml')
identity = aapt('dump', 'badging', str(apk))
assert "package: name='io.github.openchordbook'" in identity, 'Release application ID must match its F-Droid metadata'
assert "application-label:'OpenChordBook'" in identity, 'Launcher name must be OpenChordBook'
assert re.search(r'android:allowBackup.*=\(type 0x12\)0x0', manifest), 'Backup must be disabled in APK'
assert re.search(r'android:usesCleartextTraffic.*=\(type 0x12\)0x0', manifest), 'Cleartext must be disabled'
assert not re.search(r'android:debuggable.*=\(type 0x12\)0xffffffff', manifest), 'Release must not be debuggable'
assert 'securitytest' not in manifest
assert 'android.intent.category.BROWSABLE' not in manifest, 'No incoming URI/deep-link handler'
permissions = aapt('dump', 'permissions', str(apk))
uses = set(re.findall(r"uses-permission: name='([^']+)'", permissions))
assert uses <= {'android.permission.INTERNET', 'io.github.openchordbook.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}, uses
assert 'android.permission.INTERNET' in uses
# Release resource optimization shortens XML file names; resolve through the table.
resources = aapt('dump', '--values', 'resources', str(apk))
def xml_resource(name):
    match = re.search(r'resource [^\n]+:xml/' + name + r':[^\n]+\n\s*\(string8\) \"([^\"]+)\"', resources)
    assert match, f'Missing compiled resource: {name}'
    return aapt('dump', 'xmltree', str(apk), match.group(1))
rules = xml_resource('data_extraction_rules')
assert 'E: cloud-backup' in rules and 'E: device-transfer' in rules
for domain in ['root','file','database','sharedpref','external','device_root','device_file','device_database','device_sharedpref']:
    assert rules.count(f'domain="{domain}"') == 2, f'Missing exclusion: {domain}'
assert rules.count('path="."') == 18
legacy = xml_resource('backup_rules')
assert legacy.count('path="."') == 5
with zipfile.ZipFile(apk) as archive:
    assets = [name for name in archive.namelist() if name.startswith('assets/web/')]
    for name in assets:
        source = root / name.removeprefix('assets/web/')
        assert source.is_file() and archive.read(name) == source.read_bytes(), f'Stale asset: {name}'
    assert not any(name.endswith(('.jks','.keystore','.p12','.so')) for name in archive.namelist())
if not args.unsigned:
    verified = subprocess.check_output([str(build_tools / 'apksigner'), 'verify', '--verbose', str(apk)], text=True)
    assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in verified
signature = 'unsigned (signature check skipped)' if args.unsigned else 'signed'
print(f'PASS: {signature} non-debuggable APK; Internet-only device permission; HTTPS-only networking; backup/transfer exclusions; {len(assets)} assets match source; no test package, deep-link handler, private keys or native libraries.')
