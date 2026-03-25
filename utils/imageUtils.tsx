export interface ImageCompressResult {
  dataUrl: string;
  size: number; // bytes
}

/**
 * Compress an image file to a target byte size (best-effort).
 * Returns best-effort { dataUrl, size } or null on fatal error.
 *
 * Strategy:
 *  - Prefer createImageBitmap(file, {imageOrientation: 'from-image'}) to preserve EXIF orientation if available
 *  - Fall back to drawing an <img> into a canvas
 *  - Iterate over scales (reduce dimensions) and formats (webp -> jpeg) and quality levels
 *  - Measure exact blob size via fetch(dataUrl).blob().size rather than approximating
 */
export const compressImageToTarget = async (file: File, targetBytes: number): Promise<ImageCompressResult | null> => {
  const imgUrl = URL.createObjectURL(file);

  try {
    // Prefer createImageBitmap to respect EXIF orientation when supported
    let bitmap: ImageBitmap | null = null;
    if ('createImageBitmap' in window) {
      try {
        // @ts-ignore -- some browsers accept imageOrientation
        bitmap = await (createImageBitmap as any)(file, { imageOrientation: 'from-image' });
      } catch (e) {
        bitmap = null;
      }
    }

    // Fallback to an Image element
    let imgEl: HTMLImageElement | null = null;
    if (!bitmap) {
      imgEl = new (window as any).Image();
      imgEl.src = imgUrl;
      await new Promise<void>((resolve, reject) => {
        imgEl!.onload = () => resolve();
        imgEl!.onerror = () => reject(new Error('Image load failed'));
      });
    }

    const width = (bitmap as any)?.width ?? imgEl!.width;
    const height = (bitmap as any)?.height ?? imgEl!.height;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(imgUrl); return null; }

    const MAX_DIM = 1024;
    let scale = Math.min(1, MAX_DIM / Math.max(width, height));

    let best: ImageCompressResult | null = null;
    const formats = ['image/webp', 'image/jpeg'];

    const measureSize = async (dataUrl: string) => {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      return blob.size;
    };

    for (let s = scale; s >= 0.2; s *= 0.9) {
      canvas.width = Math.max(1, Math.round(width * s));
      canvas.height = Math.max(1, Math.round(height * s));
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bitmap) ctx.drawImage(bitmap as ImageBitmap, 0, 0, canvas.width, canvas.height);
      else ctx.drawImage(imgEl as HTMLImageElement, 0, 0, canvas.width, canvas.height);

      for (const fmt of formats) {
        for (let q = 0.9; q >= 0.05; q -= 0.05) {
          const dataUrl = canvas.toDataURL(fmt, q);
          const size = await measureSize(dataUrl);
          if (!best || size < best.size) best = { dataUrl, size };
          if (size <= targetBytes) {
            URL.revokeObjectURL(imgUrl);
            return { dataUrl, size };
          }
        }
      }
    }

    URL.revokeObjectURL(imgUrl);
    return best;
  } catch (e) {
    URL.revokeObjectURL(imgUrl);
    console.error('compressImageToTarget error', e);
    return null;
  }
};