/** Largest upload we accept before resizing. */
export const MAX_UPLOAD_MB = 10;

/**
 * Reads an image file and returns a resized JPEG data URL (longest side ≤ maxSide).
 * Keeps listing photos small enough to store until a real upload API exists.
 */
export async function imageToDataUrl(file: File, maxSide = 900, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG or PNG).');
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`That photo is over ${MAX_UPLOAD_MB} MB. Please choose a smaller one.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('We couldn’t read that image. Try another photo.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser couldn’t process the image.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
