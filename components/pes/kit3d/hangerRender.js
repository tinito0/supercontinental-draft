// «Imagen en percha»: the shirt of the kit on screen, alone and from the front, hanging on a hanger over a light studio
// wall, as a 3072 × 3840 image (3840 px tall: 4K portrait). The 3D shirt comes from the viewer's own WebGL renderer
// (kitRenderer.js), drawn once with a transparent background; the wall, the hanger and the shadow are drawn in 2D
// around it. Only for the image: the viewer re-uploads its full kit right after.
import { KitGL, lightState } from './kitRenderer.js';
import { fitParts } from '../../../pes/kits/kitModels.js';

export const HANGER_IMAGE = { width: 3072, height: 3840 };
const SHIRT_PARTS = new Set(['shirt', 'sleeve', 'collar']);
// Of the final image: how wide the shirt is and where its collar sits.
const SHIRT_WIDTH = 0.76;
const SHIRT_MAX_HEIGHT = 0.72;
const SHIRT_TOP = 0.2;

/** Bounding box of the opaque pixels, measured on a small copy (a full-size scan is ~50 MB of pixels). */
function opaqueBox(source) {
  const scale = Math.min(1, 512 / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
  const probe = document.createElement('canvas');
  probe.width = w; probe.height = h;
  const g = probe.getContext('2d', { willReadFrequently: true });
  g.drawImage(source, 0, 0, w, h);
  const { data } = g.getImageData(0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < 24) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;
  const pad = 2;
  return {
    x: Math.max(0, (minX - pad) / scale), y: Math.max(0, (minY - pad) / scale),
    w: Math.min(source.width, (maxX - minX + 1 + pad * 2) / scale), h: Math.min(source.height, (maxY - minY + 1 + pad * 2) / scale),
  };
}

function drawWall(g, W, H) {
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#f4f5f7');
  wall.addColorStop(1, '#d6dae0');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  // A soft light behind the shirt, like a studio spot.
  const spot = g.createRadialGradient(W / 2, H * 0.42, W * 0.05, W / 2, H * 0.42, W * 0.7);
  spot.addColorStop(0, 'rgba(255,255,255,0.75)');
  spot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = spot;
  g.fillRect(0, 0, W, H);
}

/**
 * The hanger: a chrome hook above the collar and a wooden bar along the shoulders. Drawn before the shirt, so the
 * shirt covers the bar and only the hook and the bit seen through the collar show.
 */
function drawHanger(g, cx, top, shirtW, H) {
  // Narrower than the shoulders: a real hanger sits inside the shirt, only its middle shows through the collar.
  const barY = top + shirtW * 0.05;
  const half = shirtW * 0.3;
  const stroke = Math.max(6, shirtW * 0.012);
  // Bar: a shallow arch of wood.
  const wood = g.createLinearGradient(0, barY - stroke * 3, 0, barY + stroke * 3);
  wood.addColorStop(0, '#b98a5a');
  wood.addColorStop(0.5, '#8e643c');
  wood.addColorStop(1, '#6d4a2a');
  g.lineCap = 'round';
  g.strokeStyle = wood;
  g.lineWidth = stroke * 3.2;
  g.beginPath();
  g.moveTo(cx - half, barY + shirtW * 0.08);
  g.quadraticCurveTo(cx, barY - shirtW * 0.04, cx + half, barY + shirtW * 0.08);
  g.stroke();
  // Hook: a neck up from the bar, then the curl.
  const chrome = g.createLinearGradient(cx - stroke * 4, 0, cx + stroke * 4, 0);
  chrome.addColorStop(0, '#9aa1ab');
  chrome.addColorStop(0.45, '#f5f7fa');
  chrome.addColorStop(1, '#7c838d');
  g.strokeStyle = chrome;
  g.lineWidth = stroke;
  const neckTop = top - H * 0.05;
  const r = shirtW * 0.055;
  g.beginPath();
  g.moveTo(cx, barY);
  g.lineTo(cx, neckTop);
  g.arc(cx + r, neckTop, r, Math.PI, Math.PI * 1.9, false);
  g.stroke();
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('El navegador no pudo generar la imagen.'))), type, quality));
}

/**
 * Renders the hanger image. Leaves the renderer with only the shirt uploaded: the caller uploads its parts again.
 * @param {{ R: object, parts: object[], colors: object, textured: Set<string>, light?: string }} input
 *   R: the viewer's KitGL renderer, with the kit texture already set; parts: the refined parts on screen
 * @returns {Promise<{ png: Blob, compact: Blob }>} png to download; compact (webp, or jpg) to publish on the club page
 */
export async function renderKitOnHanger({ R, parts, colors, textured, light = 'estudio' }) {
  const shirt = parts.filter(part => SHIRT_PARTS.has(part.k));
  if (!shirt.length) throw new Error('Este kit no tiene camiseta para mostrar.');
  const gl = R.gl;
  const glCanvas = gl.canvas;
  const limit = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096, gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.[1] || 4096, 4096);
  const fit = fitParts(shirt);
  KitGL.upload(R, shirt);
  glCanvas.width = Math.round(limit * 0.8);
  glCanvas.height = limit;
  const L = lightState(light);
  KitGL.setTex(R, 4, L.env.canvas);
  // Straight from the front and a narrow lens: closer to a catalogue photo than to the orbit camera.
  KitGL.draw(R, {
    fit, yaw: fit.yaw0, pitch: 0, dist: fit.radius * 4.6, fov: 30, panX: 0, panY: 0, ortho: false, bg: false,
    bump: 1, nrm: true, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, ao: 1, L, textured, colors,
  });
  // preserveDrawingBuffer: the frame can be copied right away, before anything else draws.
  const shot = document.createElement('canvas');
  shot.width = glCanvas.width; shot.height = glCanvas.height;
  shot.getContext('2d').drawImage(glCanvas, 0, 0);
  const box = opaqueBox(shot);
  if (!box) throw new Error('No se pudo dibujar la camiseta.');

  const { width: W, height: H } = HANGER_IMAGE;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  drawWall(g, W, H);
  const scale = Math.min((W * SHIRT_WIDTH) / box.w, (H * SHIRT_MAX_HEIGHT) / box.h);
  const dw = box.w * scale, dh = box.h * scale;
  const dx = (W - dw) / 2, dy = H * SHIRT_TOP;
  drawHanger(g, W / 2, dy, dw, H);
  g.save();
  g.shadowColor = 'rgba(20, 26, 38, 0.28)';
  g.shadowBlur = W * 0.03;
  g.shadowOffsetY = H * 0.014;
  g.drawImage(shot, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
  g.restore();

  const png = await toBlob(out, 'image/png');
  let compact = await toBlob(out, 'image/webp', 0.92);
  // Browsers without a WEBP encoder hand back a PNG: JPG keeps the upload light.
  if (compact.type !== 'image/webp') compact = await toBlob(out, 'image/jpeg', 0.92);
  return { png, compact };
}
