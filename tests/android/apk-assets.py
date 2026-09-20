"""Check the release boundary: code/assets/catalog metadata, never tune exports."""
import json
import re
import sys
import zipfile

apk_path = sys.argv[1] if len(sys.argv) > 1 else 'android/app/build/outputs/apk/release/app-release.apk'
with zipfile.ZipFile(apk_path) as apk:
    assets = [name for name in apk.namelist() if name.startswith('assets/web/')]
    assert assets, 'The APK must contain the web app'
    assert [name for name in assets if name.endswith('.html')] == ['assets/web/index.html']
    assert [name for name in assets if name.endswith('.json')] == ['assets/web/data/catalog.json']
    for name in assets:
        assert not name.endswith(('.db', '.sqlite', '.zip', '.ireal', '.irealb')), name
        if name.endswith(('.html', '.js', '.json')):
            assert not re.search(rb'irealb://[^\s\"\'<>]*1r34LbKcu7', apk.read(name)), f'Bundled playlist in {name}'
    catalog = json.loads(apk.read('assets/web/data/catalog.json'))
    allowed = {'id', 'title', 'url', 'source', 'description', 'songCount', 'scrape', 'download'}
    ids = set()
    for category in catalog['categories']:
        for item in category['items']:
            assert item['id'] not in ids and re.fullmatch(r'[a-z0-9-]+', item['id'])
            ids.add(item['id'])
            assert set(item) <= allowed, f'Unexpected catalog payload: {item["title"]}'
            assert set(item.get('scrape', {})) <= {'url', 'name'}
            for url in [item['url'], item.get('download'), item.get('scrape', {}).get('url')]:
                assert url is None or url.startswith('https://'), f'Catalog should hold source URLs: {url}'
print('PASS: APK contains app assets and catalog metadata, with no tune exports, playlist URIs or tune databases.')
