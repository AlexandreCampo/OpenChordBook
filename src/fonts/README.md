# Bundled typography

These WOFF2 files keep the interface available offline, without font services.

- **Jazz Sans** is a Latin subset of Adobe's **Source Sans 3** (regular and semibold), renamed to respect the reserved font name. Copyright 2023 Adobe. See `SourceSans3-LICENSE.md` (SIL OFL 1.1).
- **Noto Serif** (regular and italic) is a Latin subset. Copyright 2022 The Noto Project Authors. See `NotoSerif-LICENSE.txt` (SIL OFL 1.1).

Subsets retain U+0020–024F, U+2000–206F and available flat/natural/sharp symbols. Other scripts fall back to the system fonts. FontTools was used to subset, rename the modified Source fonts, and encode WOFF2. The original font copyright and license metadata are retained.
