// Browser-only: decodes an image file to straight (non-premultiplied) RGBA.
// A 2D canvas premultiplies colour by alpha, which corrupts kit textures that keep the
// shine mask in the alpha channel, so WebGL is used when available (approach from
// PES Editor Rebuilt js/ftexenc.js rawFromImage, BSD-3-Clause).

/** @returns {Promise<{ width: number, height: number, pixels: Uint8Array, premultiplied: boolean }>} */
export async function decodeImageFile(file) {
  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
  if (gl) {
    try {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return { width, height, pixels, premultiplied: false };
    } finally {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      bitmap.close?.();
    }
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return { width, height, pixels: new Uint8Array(ctx.getImageData(0, 0, width, height).data.buffer), premultiplied: true };
}

/** Loads a user font file (TTF/OTF/WOFF/WOFF2) under a unique family name. */
export async function loadFontFile(file) {
  const family = `pes-font-${file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]/g, '')}-${Date.now()}`;
  const face = new FontFace(family, await file.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  return family;
}
