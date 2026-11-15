// Comprime la foto en el navegador y la sube a ImgBB.
// Una foto de móvil pasa de ~5 MB a ~300 KB: sube mucho más rápido con datos.

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se ha podido procesar la foto.'))), 'image/jpeg', QUALITY),
  );
}

export async function uploadImage(file) {
  const key = import.meta.env.VITE_IMGBB_API_KEY;
  if (!key) throw new Error('Falta VITE_IMGBB_API_KEY en el archivo .env');

  let body = file;
  try {
    body = await compressImage(file);
  } catch {
    // Formatos que el navegador no sabe dibujar (p. ej. HEIC en escritorio): se sube el original.
  }

  const form = new FormData();
  form.append('image', body, 'cerveza.jpg');

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');
  return data.data.display_url || data.data.url;
}
