// Fotos en Firebase Storage. No hay ninguna llave en la web: las reglas de storage.rules
// solo dejan subir a usuarios con el correo confirmado, imágenes de menos de 2 MB y en su carpeta.
//
// Se acepta cualquier foto de la galería (JPG, PNG, WebP, GIF, AVIF, HEIC/HEIF de iPhone…):
// se abre en el navegador, se reduce a 1600 px y se guarda siempre como JPEG, que se ve en todos lados.

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase.js';

const MAX_SIDE = 1600;
const QUALITY = 0.82;
export const MAX_BYTES = 2 * 1024 * 1024;

const HEIC_NAME = /\.(heic|heif)$/i;
const HEIC_TYPE = /image\/hei[cf]/i;

/** Intenta abrir la foto como <img> (Safari abre HEIC así; también sirve si createImageBitmap falla). */
function loadAsImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se puede abrir la imagen')); };
    img.src = url;
  });
}

async function isHeicFile(file) {
  if (HEIC_TYPE.test(file.type) || HEIC_NAME.test(file.name ?? '')) return true;
  // Algunas galerías mandan las HEIC sin tipo ni extensión: miramos la cabecera del archivo.
  const header = new Uint8Array(await file.slice(4, 12).arrayBuffer());
  const brand = String.fromCharCode(...header);
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(brand);
}

/** Convierte una HEIC a JPEG con libheif. Solo se descarga si de verdad hace falta. */
async function heicToJpeg(file) {
  const { heicTo } = await import('heic-to');
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
}

/** Abre la foto con el primer método que funcione en este navegador. */
async function decode(file) {
  try {
    return await createImageBitmap(file);
  } catch { /* sigue probando */ }
  try {
    return await loadAsImage(file);
  } catch { /* sigue probando */ }
  if (await isHeicFile(file)) {
    const jpeg = await heicToJpeg(file);
    try {
      return await createImageBitmap(jpeg);
    } catch {
      return loadAsImage(jpeg);
    }
  }
  throw new Error('unsupported');
}

export async function compressImage(file) {
  const source = await decode(file);
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  // Fondo blanco: los PNG transparentes se quedarían negros al pasarlos a JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas'))), 'image/jpeg', QUALITY),
  );
}

/** Para la vista previa: devuelve una URL que el navegador pueda pintar (convierte HEIC si hace falta). */
export async function previewUrl(file) {
  try {
    await loadAsImage(file);
    return URL.createObjectURL(file);
  } catch {
    const blob = await compressImage(file);
    return URL.createObjectURL(blob);
  }
}

/** Sube la foto y devuelve { imageUrl, imagePath }. */
export async function uploadImage(file, uid) {
  let blob;
  try {
    blob = await compressImage(file);
  } catch {
    throw new Error('No hemos podido abrir esa foto. Prueba a hacer una captura de pantalla de ella y sube la captura.');
  }
  if (blob.size > MAX_BYTES) throw new Error('La foto es demasiado grande incluso comprimida. Prueba con otra.');

  const imagePath = `beers/${uid}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const fileRef = ref(storage, imagePath);
  try {
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000' });
  } catch (error) {
    if (error?.code === 'storage/unauthorized') throw new Error('Confirma tu correo para poder subir fotos.');
    throw new Error('No se ha podido subir la foto. Revisa la conexión e inténtalo de nuevo.');
  }
  return { imageUrl: await getDownloadURL(fileRef), imagePath };
}

/** Borra la foto de una publicación (las antiguas de ImgBB no tienen imagePath y se ignoran). */
export async function deleteImage(imagePath) {
  if (!imagePath) return;
  await deleteObject(ref(storage, imagePath)).catch(() => {});
}
