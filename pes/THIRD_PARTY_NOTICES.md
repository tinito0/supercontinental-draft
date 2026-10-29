# Third-party notices — PES engine

## PES Editor Rebuilt (BSD 3-Clause)

Adapted code: `pes/formats/pes2021/editCrypto.js` (from `js/pescrypt.js`), `pes/formats/pes2021/editLayout.js`
(from `js/pesdata.js`), `pes/kits/ftex.js` (writer from `js/ftexenc.js`), `pes/kits/kitFonts.js` (glyph cells from
`js/kitfont.js`), `pes/kits/kitTextures.js` (slot list from `js/kitstudio.js`), `pes/kits/imageDecode.js`
(approach of `rawFromImage`), `pes/kits/textureDecode.js` (DXT/BC7 decoders from `js/dds.js`),
`pes/kits/kitModels.js` (from `js/kit3d.js`: k3Pack, k3Load, weld, k3Fit), `pes/kits/fabricMaps.js` (from `js/kitmat.js`;
the honeycomb weave was changed to whole periods so it tiles), `components/pes/kit3d/kitRenderer.js` (verbatim
K3LIGHTS / K3ENV.scene / K3GL from `js/kit3d.js`), `components/pes/kit3d/kitDecals.js` (KFONT from `js/kitfont.js`;
composition from `js/kitstudio.js`). Source inspected: `vendor/Pes-Editor-Rebuilt-main` (v0.044 alpha).

`public/kit3d/kitpack.bin` is the garment model pack (shirt, sleeves, collars, shorts, socks) shipped by PES Editor
Rebuilt in `js/kitpack.js`, converted from base64 to binary without changes. Rebuilt credits the meshes to the
**CometKIT previewer V1.01b**; they derive from game models. They are only used to preview kits inside the editor.

```
BSD 3-Clause License

Copyright (c) 2026, AgustinMarconi27

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Upstream work carried through PES Editor Rebuilt

- **libpesXcrypter** (the4chancup) — public domain. EDIT00000000 encryption algorithm and keys.
- **4ccEditor** (the4chancup) — zlib license. EDIT00000000 player/team field layout.
  "This software is provided 'as-is', without any express or implied warranty. … Altered source versions must be
  plainly marked as such, and must not be misrepresented as being the original software." The layout here is
  altered (converted to the descriptor format of `pes/core/fields.js`).

## PES 2020 Editor V0.12.8 by Ejogc327

No code is reproduced. Only numeric layout facts (record sizes, byte offsets, bit widths, value offsets) were read
from the decompiled assembly (`PES2020Editor.exe`, sha256 `51e967a1…e367`) for interoperability with the PES 2021
database files, and every field used was verified against real data (see `docs/PES_ENGINE.md`). String
obfuscation in that assembly was not circumvented.

## bcdec (Sergii Kudlai) — MIT / public domain

The BC7 block decoder in `pes/kits/textureDecode.js` comes, through PES Editor Rebuilt, from bcdec
(https://github.com/iOrange/bcdec), dual-licensed MIT / Unlicense.

## Libraries

`fflate` (MIT), `jszip` (MIT/GPLv3 dual), `@supabase/supabase-js` (MIT); dev only: `firebase-admin`,
`@firebase/rules-unit-testing` (Apache-2.0).
