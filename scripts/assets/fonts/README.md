# Engineering carrier font

`NotoSansSC-Regular.otf` is an unmodified existing local Noto Sans SC font, copied
from `C:/Windows/Fonts/Noto Sans SC (TrueType).otf` on 2026-10-02. It is a test
resource only; it is not imported into product assets and adds no package dependency.

SHA-256: `a2b93e6c2db05d6bbbf6f27d413ec73269735b7b679019c8a5aa9670ff0ffbf2`.
Upstream: https://github.com/notofonts/noto-cjk . License: SIL OFL 1.1, included
verbatim in `OFL.txt` from https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE .
The font's embedded name table retains its original copyright and license notices.

The carrier renderer checks this hash, checks every notice character against the
font's Unicode cmap, and renders two distinct Chinese glyphs before writing carriers.
It must fail visibly on missing glyphs; system font fallback is not an acceptance test.
New output always uses a fresh temporary directory; old carriers are never overwritten.
