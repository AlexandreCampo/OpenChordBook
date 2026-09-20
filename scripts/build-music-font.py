#!/usr/bin/env python3
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
"""Build Jazz Music from OFL Bravura and Noto Serif; no iRealFont outlines.

Usage: python3 scripts/build-music-font.py /path/to/Bravura.otf
Requires fonttools (including its WOFF2/Brotli support for the Noto input).
See vendor/css/FONT.md for the pinned upstream source and checksum.
"""
import hashlib
import json
import sys
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
EXPECTED_SHA256 = "cdf0f893ee1fdb64b7f6713d71ee0dcfc349c0ac01429a8e451b01a9e79f5f3b"
if hashlib.sha256(source.read_bytes()).hexdigest() != EXPECTED_SHA256:
    raise SystemExit('Unexpected Bravura source; see vendor/css/FONT.md')
bravura = TTFont(source)
noto = TTFont(ROOT / 'src/fonts/NotoSerif-Regular.woff2')
# Private renderer code points -> SMuFL Bravura code points.
symbols = {
    0xE000: 0xE030, 0xE001: 0xE031, 0xE002: 0xE032, 0xE003: 0xE033,
    0xE004: 0xE040, 0xE005: 0xE041, 0xE012: 0xE4C0, 0xE013: 0xE047,
    0xE014: 0xE048, 0xE015: 0xE049, 0xE016: 0xE102, 0xE017: 0xE101,
    0xE020: 0xE504, 0xE021: 0xE500, 0xE022: 0xE501, 0xE023: 0xE502,
}
metrics = json.loads((ROOT / 'scripts/music-font-metrics.json').read_text())
glyphs = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
hmetrics = {'.notdef': (512, 0), 'space': (256, 0)}
cmap = {32: 'space'}
for key, (advance, left, bottom, right, top) in metrics.items():
    code = int(key)
    if code in symbols:
        font, points = bravura, [symbols[code]]
    elif code in (0xE010, 0xE011):
        font, points = noto, list(map(ord, 'D.S.' if code == 0xE010 else 'N.C.'))
    else:
        font = bravura
        points = [0xE080 + int(d) for d in str(code - (0xE030 if code < 0xE040 else 0xE040))]
    font_glyphs, font_cmap = font.getGlyphSet(), font.getBestCmap()
    outline = DecomposingRecordingPen(font_glyphs)
    offset = 0
    for point in points:
        name = font_cmap[point]
        font_glyphs[name].draw(TransformPen(outline, (1, 0, 0, 1, offset, 0)))
        offset += font['hmtx'][name][0]
    bounds = BoundsPen(None)
    outline.replay(bounds)
    x0, y0, x1, y1 = bounds.bounds
    sx, sy = (right - left) / (x1 - x0), (top - bottom) / (y1 - y0)
    pen = TTGlyphPen(None)
    outline.replay(TransformPen(Cu2QuPen(pen, max_err=0.5, reverse_direction=True),
                                (sx, 0, 0, sy, left - x0 * sx, bottom - y0 * sy)))
    name = f'uni{code:04X}'
    glyphs[name], hmetrics[name], cmap[code] = pen.glyph(), (advance, left), name

fb = FontBuilder(1024, isTTF=True)
fb.setupGlyphOrder(list(glyphs))
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(hmetrics)
fb.setupHorizontalHeader(ascent=819, descent=-204)
fb.setupNameTable({
    'familyName': 'Jazz Music', 'styleName': 'Regular', 'uniqueFontIdentifier': 'JazzMusic-1.0',
    'fullName': 'Jazz Music Regular', 'psName': 'JazzMusic-Regular', 'version': 'Version 1.0',
    'copyright': 'Copyright 2026 Steinberg Media Technologies GmbH. Copyright 2022 The Noto Project Authors. Modifications Copyright 2026 Alexandre Campo.',
    'licenseDescription': 'Licensed under the SIL Open Font License, Version 1.1. See licenses/Bravura-OFL.txt and src/fonts/NotoSerif-LICENSE.txt.',
    'licenseInfoURL': 'https://openfontlicense.org/',
})
fb.setupOS2(sTypoAscender=819, sTypoDescender=-204, usWinAscent=1140, usWinDescent=217)
fb.setupPost()
fb.setupMaxp()
# Stable timestamps: repeated runs produce byte-identical font assets.
fb.font['head'].created = fb.font['head'].modified = 3862166400
fb.font.recalcTimestamp = False
target = ROOT / 'vendor/css/JazzMusic.ttf'
fb.save(target)
fb.font.flavor = 'woff'
fb.save(target.with_suffix('.woff'))
print('Built JazzMusic.ttf and JazzMusic.woff from verified OFL inputs')
