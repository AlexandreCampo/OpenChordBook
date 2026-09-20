# Jazz Music

Jazz Music replaces iRealFont, whose upstream font project includes OPTI
Century Schoolbook outlines with unclear licensing. No original iRealFont
outlines are copied. The renderer's numeric layout dimensions and private
code-point mapping are preserved in scripts/music-font-metrics.json.

All music glyph outlines come from Steinberg's Bravura under SIL OFL 1.1.
N.C. and D.S. use the already bundled OFL Noto Serif. Time signatures combine
Bravura's timeSig0–timeSig9 glyphs. The mapping uses the W3C SMuFL specification:
https://w3c.github.io/smufl/latest/tables/

Pinned source:
https://raw.githubusercontent.com/steinbergmedia/bravura/37b194378b710cc40e406ab6c4b07608bb9548ae/redist/otf/Bravura.otf

SHA-256:
cdf0f893ee1fdb64b7f6713d71ee0dcfc349c0ac01429a8e451b01a9e79f5f3b

Rebuild from the project root, with Python FontTools and Brotli installed:

```sh
curl -fL https://raw.githubusercontent.com/steinbergmedia/bravura/37b194378b710cc40e406ab6c4b07608bb9548ae/redist/otf/Bravura.otf -o /tmp/Bravura.otf
python3 scripts/build-music-font.py /tmp/Bravura.otf
```

The script validates the input checksum and writes JazzMusic.ttf and
JazzMusic.woff deterministically. FontTools 4.64.0 was used for this release
(check your local version when comparing binaries). Fonts are checked in as
redistributable assets; normal APK builds do not download or regenerate them.

The font is renamed to avoid Bravura's Reserved Font Name. The generated
font remains SIL OFL 1.1, not GPL. Full notices are in licenses/Bravura-OFL.txt
and src/fonts/NotoSerif-LICENSE.txt; embedded metadata also identifies OFL.
