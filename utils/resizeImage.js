// Achica una imagen en el navegador antes de subirla (escudos de equipos). Los escudos llegaban de hasta
// 12.756 × 12.756 px y 1,2 MB, y se muestran a 20–76 px: en el celular eso era descarga y memoria de sobra.
// Si el navegador no puede decodificarla o no sale más chica, devuelve el archivo original sin cambios.
export const MAX_LOGO_SIZE = 512;

/** Dimensiones finales manteniendo la proporción, sin agrandar nunca. */
export function fitWithin(width, height, max = MAX_LOGO_SIZE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function resizeImageFile(file, { max = MAX_LOGO_SIZE, quality = 0.9 } = {}) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    // Primero se lee el tamaño real y después se decodifica ya achicada: un PNG/WebP gigante decodificado
    // entero puede ocupar cientos de MB en un celular.
    const probe = await createImageBitmap(file);
    const { width, height } = fitWithin(probe.width, probe.height, max);
    probe.close?.();
    const bitmap = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    return file;
  }
}
