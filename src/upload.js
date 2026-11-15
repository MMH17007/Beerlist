// Fotos en Firebase Storage. No hay ninguna llave en la web: las reglas de storage.rules
// solo dejan subir a usuarios con el correo confirmado, imágenes de menos de 2 MB y en su carpeta.

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase.js';

const MAX_SIDE = 1600;
const QUALITY = 0.82;
export const MAX_BYTES = 2 * 1024 * 1024;

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

/** Sube la foto y devuelve { imageUrl, imagePath }. */
export async function uploadImage(file, uid) {
  let blob;
  try {
    blob = await compressImage(file);
  } catch {
    throw new Error('Ese formato de foto no se puede usar. Prueba con una JPG o PNG.');
  }
  if (blob.size > MAX_BYTES) throw new Error('La foto es demasiado grande incluso comprimida. Prueba con otra.');

  const imagePath = `beers/${uid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const fileRef = ref(storage, imagePath);
  try {
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' });
  } catch (error) {
    if (error?.code === 'storage/unauthorized') throw new Error('Confirma tu correo para poder subir fotos.');
    throw new Error('No se ha podido subir la foto. Inténtalo de nuevo.');
  }
  return { imageUrl: await getDownloadURL(fileRef), imagePath };
}

/** Borra la foto de una publicación (las antiguas de ImgBB no tienen imagePath y se ignoran). */
export async function deleteImage(imagePath) {
  if (!imagePath) return;
  await deleteObject(ref(storage, imagePath)).catch(() => {});
}
