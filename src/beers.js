// Cervezas: muro común, mi bodega, valoraciones y publicaciones.

import {
  addDoc, collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { uploadImage } from './upload.js';
import {
  $, closeDialog, confirmAction, friendlyError, h, icon, openDialog, setBusy, showError, timeAgo, toast,
} from './ui.js';

const STAR_LABELS = ['', 'No repetiría', 'Floja', 'Correcta', 'Muy buena', 'De las mejores'];

let me = null;
let beers = [];
let loaded = false;
let activeBeerId = null;
let currentRating = 0;
let selectedFile = null;

/* ---------- Datos ---------- */

function stats(beer) {
  const ratings = Object.values(beer.ratings ?? {});
  const count = ratings.length;
  const avg = count ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / count : 0;
  return { count, avg };
}

const myRating = (beer) => beer.ratings?.[me.uid] ?? null;
const findBeer = (id) => beers.find((b) => b.id === id);

/* ---------- Render ---------- */

function skeletons(grid, n = 8) {
  grid.replaceChildren(...Array.from({ length: n }, () => h('div', { class: 'skeleton aspect-[3/4]' })));
}

function emptyState({ iconName, title, text, action }) {
  return h('div', { class: 'empty-state' },
    h('div', { class: 'mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mustard-50 text-2xl text-mustard-ink' }, icon(iconName)),
    h('h2', { class: 'mb-1 text-lg font-bold text-gray-900' }, title),
    h('p', { class: 'mb-6 max-w-sm text-sm text-gray-600' }, text),
    action ?? null);
}

function beerCard(beer, { showMine = false } = {}) {
  const { count, avg } = stats(beer);
  const mine = myRating(beer);

  const footer = showMine && mine
    ? h('p', { class: 'mt-1 line-clamp-2 text-xs text-gray-600 italic' }, mine.comment || 'Sin comentario')
    : h('div', { class: 'mt-1 flex items-center justify-between text-xs text-gray-600' },
      h('span', { class: 'flex items-center gap-1 font-bold text-mustard-ink' }, icon('star'), count ? avg.toFixed(1) : '–'),
      h('span', {}, `${count} ${count === 1 ? 'nota' : 'notas'}`));

  const badge = mine
    ? h('span', { class: 'absolute top-2 right-2 flex items-center gap-1 rounded-full bg-mustard-dark px-2 py-1 text-xs font-bold text-gray-950 shadow' },
      icon('star'), showMine ? `${mine.rating}` : 'Probada')
    : null;

  return h('article', { class: 'beer-card' },
    h('button', { type: 'button', class: 'block w-full text-left', onclick: () => openDetail(beer.id), 'aria-label': `${beer.name}, ${count ? `media ${avg.toFixed(1)}` : 'sin notas'}` },
      h('div', { class: 'relative aspect-square bg-gray-100' },
        h('img', { src: beer.imageUrl, alt: '', loading: 'lazy', decoding: 'async', class: 'h-full w-full object-cover' }),
        badge),
      h('div', { class: 'p-3' },
        h('h3', { class: 'truncate text-sm font-bold text-gray-900' }, beer.name),
        footer)));
}

function sortedAndFiltered() {
  const term = $('#beer-search').value.trim().toLowerCase();
  const sort = $('#beer-sort').value;
  let list = beers.filter((b) => !term || b.name.toLowerCase().includes(term));
  if (sort === 'pending') list = list.filter((b) => !myRating(b));
  if (sort === 'top') list = [...list].sort((a, b) => stats(b).avg - stats(a).avg);
  if (sort === 'popular') list = [...list].sort((a, b) => stats(b).count - stats(a).count);
  return list;
}

function renderHome() {
  const grid = $('#home-grid');
  if (!loaded) return skeletons(grid);

  if (beers.length === 0) {
    return grid.replaceChildren(emptyState({
      iconName: 'beer-mug-empty',
      title: 'La barra está vacía',
      text: 'Sube la primera cerveza y estrena la comunidad.',
      action: h('button', { type: 'button', class: 'btn-primary', onclick: openAddBeer }, icon('camera'), 'Subir la primera'),
    }));
  }

  const list = sortedAndFiltered();
  if (list.length === 0) {
    return grid.replaceChildren(emptyState({
      iconName: 'magnifying-glass',
      title: 'Nada por aquí',
      text: 'No hay cervezas que coincidan. Prueba con otro nombre o cambia el orden.',
    }));
  }
  grid.replaceChildren(...list.map((b) => beerCard(b)));
}

function renderCellar() {
  const grid = $('#cellar-grid');
  if (!loaded) return skeletons(grid, 4);

  const mine = beers
    .filter((b) => myRating(b))
    .sort((a, b) => myRating(b).rating - myRating(a).rating);

  $('#cellar-summary').textContent = mine.length
    ? `Has valorado ${mine.length} ${mine.length === 1 ? 'cerveza' : 'cervezas'}. Ordenadas de mejor a peor.`
    : 'Las cervezas que has valorado.';

  if (mine.length === 0) {
    return grid.replaceChildren(emptyState({
      iconName: 'box-open',
      title: 'Tu bodega está vacía',
      text: 'Abre cualquier cerveza del muro y ponle nota. Aparecerá aquí con tu comentario.',
      action: h('a', { href: '#inicio', class: 'btn-secondary' }, 'Ir a explorar'),
    }));
  }
  grid.replaceChildren(...mine.map((b) => beerCard(b, { showMine: true })));
}

function render() {
  renderHome();
  renderCellar();
  if (activeBeerId) refreshDetail();
}

/* ---------- Detalle y valoración ---------- */

function renderStars() {
  const group = $('#star-group');
  group.replaceChildren(...[1, 2, 3, 4, 5].map((value) =>
    h('button', {
      type: 'button',
      role: 'radio',
      class: `star-btn ${value <= currentRating ? 'is-on' : ''}`,
      'aria-checked': String(value === currentRating),
      'aria-label': `${value} ${value === 1 ? 'estrella' : 'estrellas'}: ${STAR_LABELS[value]}`,
      onclick: () => { currentRating = value; renderStars(); },
    }, icon('star', '', value <= currentRating ? 'solid' : 'regular'))));
  $('#star-label').textContent = currentRating ? `${currentRating}/5 · ${STAR_LABELS[currentRating]}` : 'Toca una estrella';
}

function refreshDetail() {
  const beer = findBeer(activeBeerId);
  if (!beer) {
    closeDialog($('#detail-dialog'));
    return;
  }
  const { count, avg } = stats(beer);
  $('#detail-name').textContent = beer.name;
  $('#detail-meta').textContent = [
    beer.createdByName ? `Subida por ${beer.createdBy === me.uid ? 'ti' : beer.createdByName}` : null,
    timeAgo(beer.createdAt),
    count ? `★ ${avg.toFixed(1)} de media (${count})` : 'Aún sin notas',
  ].filter(Boolean).join(' · ');

  const others = Object.entries(beer.ratings ?? {})
    .filter(([uid]) => uid !== me.uid)
    .map(([, r]) => r)
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));

  $('#detail-reviews').replaceChildren(...(others.length
    ? others.map((r) => h('li', { class: 'rounded-xl bg-gray-50 p-3' },
      h('div', { class: 'flex items-center justify-between text-sm' },
        h('span', { class: 'font-bold' }, r.name || 'Anónimo'),
        h('span', { class: 'font-bold text-mustard-ink' }, '★ ', String(r.rating))),
      r.comment ? h('p', { class: 'mt-1 text-sm text-gray-700' }, r.comment) : null))
    : [h('li', { class: 'text-sm text-gray-600' }, 'Nadie más la ha valorado todavía.')]));

  $('#detail-owner').hidden = beer.createdBy !== me.uid;
  $('#rating-delete').hidden = !myRating(beer);
}

function openDetail(beerId) {
  const beer = findBeer(beerId);
  if (!beer) return;
  activeBeerId = beerId;

  const image = $('#detail-image');
  image.src = beer.imageUrl;
  image.alt = `Foto de ${beer.name}`;

  const mine = myRating(beer);
  currentRating = mine?.rating ?? 0;
  $('#rating-comment').value = mine?.comment ?? '';
  $('#rating-count').textContent = `${$('#rating-comment').value.length}/500`;
  renderStars();
  refreshDetail();
  openDialog($('#detail-dialog'));
}

async function saveRating(event) {
  event.preventDefault();
  if (!currentRating) {
    $('#star-label').textContent = 'Elige de 1 a 5 estrellas para guardar.';
    $('#star-group button')?.focus();
    return;
  }
  const button = $('#rating-save');
  setBusy(button, true, 'Guardando…');
  try {
    await updateDoc(doc(db, 'beers', activeBeerId), {
      [`ratings.${me.uid}`]: {
        rating: currentRating,
        comment: $('#rating-comment').value.trim(),
        name: me.name,
        updatedAt: serverTimestamp(),
      },
    });
    closeDialog($('#detail-dialog'));
    toast('Nota guardada en tu bodega');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  } finally {
    setBusy(button, false);
  }
}

async function deleteRating() {
  const ok = await confirmAction({
    title: '¿Borrar tu nota?',
    message: 'Se quitará de tu bodega. La cerveza seguirá en el muro.',
    confirmLabel: 'Borrar nota',
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, 'beers', activeBeerId), { [`ratings.${me.uid}`]: deleteField() });
    closeDialog($('#detail-dialog'));
    toast('Nota borrada');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  }
}

async function deletePost() {
  const beer = findBeer(activeBeerId);
  if (!beer) return;
  const { count } = stats(beer);
  const ok = await confirmAction({
    title: `¿Eliminar «${beer.name}»?`,
    message: count
      ? `Se borrará para todo el mundo junto con ${count} ${count === 1 ? 'nota' : 'notas'}. No se puede deshacer.`
      : 'Se borrará para todo el mundo. No se puede deshacer.',
    confirmLabel: 'Eliminar',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'beers', beer.id));
    closeDialog($('#detail-dialog'));
    toast('Publicación eliminada');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  }
}

/* ---------- Añadir cerveza ---------- */

function setPreview(file) {
  selectedFile = file;
  const preview = $('#add-preview');
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    $('#add-drop-hint').hidden = true;
  } else {
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.removeAttribute('src');
    preview.hidden = true;
    $('#add-drop-hint').hidden = false;
  }
}

export function openAddBeer() {
  $('#add-form').reset();
  setPreview(null);
  showError($('#add-error'), '');
  openDialog($('#add-dialog'));
}

async function publishBeer(event) {
  event.preventDefault();
  const name = $('#add-name').value.trim();
  const error = $('#add-error');
  if (!selectedFile) return showError(error, 'Añade una foto de la cerveza.');
  if (!name) {
    $('#add-name').focus();
    return showError(error, 'Escribe el nombre de la cerveza.');
  }

  const duplicate = beers.find((b) => b.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    const goOn = await confirmAction({
      title: 'Ya existe una con ese nombre',
      message: `«${duplicate.name}» ya está en el muro. ¿Quieres subirla igualmente?`,
      confirmLabel: 'Subir igualmente',
    });
    if (!goOn) return;
  }

  const button = $('#add-submit');
  showError(error, '');
  try {
    setBusy(button, true, 'Subiendo foto…');
    const imageUrl = await uploadImage(selectedFile);
    setBusy(button, true, 'Guardando…');
    const ref = await addDoc(collection(db, 'beers'), {
      name,
      imageUrl,
      createdAt: serverTimestamp(),
      createdBy: me.uid,
      createdByName: me.name,
      ratings: {},
    });
    closeDialog($('#add-dialog'));
    toast('¡Publicada! Ponle nota ahora que la tienes delante.');
    location.hash = '#inicio';
    // Abrimos directamente la valoración: es lo siguiente que casi todo el mundo quiere hacer.
    setTimeout(() => openDetail(ref.id), 300);
  } catch (err) {
    showError(error, friendlyError(err));
  } finally {
    setBusy(button, false);
  }
}

function wireAddDialog() {
  $('#add-file').addEventListener('change', (e) => setPreview(e.target.files?.[0] ?? null));
  const drop = $('#add-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-dragging');
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) setPreview(file);
  });
  $('#add-form').addEventListener('submit', publishBeer);
}

/* ---------- Arranque ---------- */

let wired = false;

export function initBeers(profile) {
  me = profile;
  beers = [];
  loaded = false;
  render();

  if (!wired) {
    wired = true;
    wireAddDialog();
    $('#rating-form').addEventListener('submit', saveRating);
    $('#rating-delete').addEventListener('click', deleteRating);
    $('#detail-delete-post').addEventListener('click', deletePost);
    $('#detail-dialog').addEventListener('close', () => { activeBeerId = null; });
    $('#rating-comment').addEventListener('input', (e) => {
      $('#rating-count').textContent = `${e.target.value.length}/500`;
    });
    $('#beer-search').addEventListener('input', renderHome);
    $('#beer-sort').addEventListener('change', renderHome);
  }

  return onSnapshot(
    query(collection(db, 'beers'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      beers = snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      loaded = true;
      render();
    },
    (error) => toast(friendlyError(error), { type: 'error' }),
  );
}
