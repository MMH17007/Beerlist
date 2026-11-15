// Panel de moderación: solo lo ven los usuarios con documento en /admins/{uid}.

import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { deleteBeer, findBeer, openDetail, removeRating } from './beers.js';
import { db } from './firebase.js';
import { $, $$, confirmAction, friendlyError, h, icon, timeAgo, toast } from './ui.js';

const REASONS = {
  ofensivo: 'Ofensivo o de mal gusto',
  spam: 'Spam o publicidad',
  'no-cerveza': 'No tiene que ver con cerveza',
  'datos-personales': 'Datos o fotos de alguien sin permiso',
  otro: 'Otro motivo',
};

let reports = [];

/** Agrupa las denuncias por contenido denunciado. */
function grouped() {
  const groups = new Map();
  for (const report of reports) {
    const key = `${report.beerId}__${report.reviewUid || 'post'}`;
    if (!groups.has(key)) groups.set(key, { key, items: [] });
    groups.get(key).items.push(report);
  }
  return [...groups.values()];
}

async function dismiss(group) {
  await Promise.all(group.items.map((r) => deleteDoc(doc(db, 'reports', r.id))));
}

async function removeContent(group) {
  const first = group.items[0];
  const what = first.reviewUid ? `el comentario de ${first.reviewName || 'este usuario'}` : `la publicación «${first.beerName}»`;
  const ok = await confirmAction({ title: '¿Borrar el contenido?', message: `Se borrará ${what}. No se puede deshacer.`, confirmLabel: 'Borrar' });
  if (!ok) return;
  try {
    if (first.reviewUid) {
      await removeRating(first.beerId, first.reviewUid);
    } else {
      const beer = findBeer(first.beerId);
      if (beer) await deleteBeer(beer);
    }
    await dismiss(group);
    toast('Contenido borrado');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  }
}

function reportCard(group) {
  const first = group.items[0];
  const exists = Boolean(findBeer(first.beerId));
  const reasons = [...new Set(group.items.map((r) => REASONS[r.reason] ?? r.reason))];
  const details = group.items.map((r) => r.details).filter(Boolean);

  return h('li', { class: 'card space-y-3 p-4' },
    h('div', { class: 'flex flex-wrap items-center gap-2' },
      h('span', { class: 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700' },
        `${group.items.length} ${group.items.length === 1 ? 'denuncia' : 'denuncias'}`),
      h('span', { class: 'text-xs text-gray-500' }, timeAgo(first.createdAt))),
    h('p', { class: 'font-bold' },
      first.reviewUid ? `Comentario de ${first.reviewName || 'un usuario'} en «${first.beerName}»` : `Publicación «${first.beerName}»`),
    first.reviewText ? h('blockquote', { class: 'rounded-lg bg-gray-50 p-3 text-sm text-gray-700 italic' }, first.reviewText) : null,
    h('p', { class: 'text-sm text-gray-600' }, h('strong', {}, 'Motivo: '), reasons.join(' · ')),
    details.length ? h('ul', { class: 'list-disc pl-5 text-sm text-gray-600' }, details.map((d) => h('li', {}, d))) : null,
    exists ? null : h('p', { class: 'text-sm text-gray-500' }, 'La publicación ya no existe.'),
    h('div', { class: 'flex flex-wrap gap-2 pt-1' },
      exists ? h('button', { type: 'button', class: 'btn-secondary min-h-10 text-sm', onclick: () => openDetail(first.beerId) }, icon('eye', '', 'regular'), 'Ver') : null,
      exists ? h('button', { type: 'button', class: 'btn-danger-soft min-h-10', onclick: () => removeContent(group) }, icon('trash'), 'Borrar contenido') : null,
      h('button', { type: 'button', class: 'btn-secondary min-h-10 text-sm', onclick: () => dismiss(group).then(() => toast('Denuncia descartada')) }, icon('check'), exists ? 'Está bien, descartar' : 'Archivar')));
}

function render() {
  const groups = grouped();
  for (const badge of $$('[data-report-count]')) {
    badge.textContent = groups.length ? String(groups.length) : '';
    badge.hidden = !groups.length;
  }
  $('#reports-list').replaceChildren(...(groups.length
    ? groups.map(reportCard)
    : [h('li', { class: 'empty-state' },
      h('div', { class: 'mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mustard-50 text-2xl text-mustard-ink' }, icon('shield-halved')),
      h('h2', { class: 'mb-1 text-lg font-bold' }, 'Todo en orden'),
      h('p', { class: 'text-sm text-gray-600' }, 'No hay denuncias pendientes.'))]));
}

export function initModeration(profile) {
  for (const el of $$('[data-admin-only]')) el.hidden = !profile.isAdmin;
  if (!profile.isAdmin) {
    if (location.hash === '#moderar') location.hash = '#inicio';
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'reports'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      reports = snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      render();
    },
    (error) => toast(friendlyError(error), { type: 'error' }),
  );
}
