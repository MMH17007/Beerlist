// El bar: mesas privadas. El ID de cada mesa ES su código, así unirse es una lectura directa
// y nadie puede listar mesas ajenas.

import {
  arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  $, closeDialog, confirmAction, copyText, friendlyError, h, icon, openDialog, setBusy, showError, toast,
} from './ui.js';

// Sin 0/O ni 1/I/L para que el código se pueda dictar sin errores.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

let me = null;
let tables = [];
let loaded = false;

function newCode() {
  const values = crypto.getRandomValues(new Uint32Array(CODE_LENGTH));
  return Array.from(values, (n) => ALPHABET[n % ALPHABET.length]).join('');
}

const cleanCode = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

async function shareCode(table) {
  const text = `Únete a mi mesa «${table.name}» en Beerlist con el código ${table.id}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Beerlist', text, url: location.origin });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  copyText(`${text}\n${location.origin}`);
}

/* ---------- Render ---------- */

function memberChip(uid, name, table) {
  const isOwner = uid === table.ownerId;
  const isMe = uid === me.uid;
  return h('li', {
    class: `flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isOwner ? 'bg-mustard-50 text-mustard-ink' : 'bg-gray-100 text-gray-700'}`,
  },
  isOwner ? h('span', { 'aria-label': 'Creador de la mesa', title: 'Creador de la mesa' }, icon('beer-mug-empty')) : null,
  isMe ? `${name} (tú)` : name);
}

function tableCard(table) {
  const isOwner = table.ownerId === me.uid;
  const members = Object.entries(table.members ?? {})
    .sort(([a], [b]) => (a === table.ownerId ? -1 : b === table.ownerId ? 1 : 0));

  return h('article', { class: 'card flex flex-col gap-4 p-5' },
    h('div', { class: 'flex items-start justify-between gap-3' },
      h('h2', { class: 'text-lg font-bold text-gray-900' }, table.name),
      h('button', {
        type: 'button',
        class: 'flex shrink-0 items-center gap-1.5 rounded-lg border border-mustard bg-mustard-50 px-2.5 py-1.5 font-mono text-sm font-bold tracking-wider text-mustard-ink',
        'aria-label': `Copiar código ${table.id}`,
        onclick: () => copyText(table.id),
      }, table.id, icon('copy', 'text-xs', 'regular'))),
    h('div', {},
      h('p', { class: 'mb-2 text-xs font-bold tracking-wider text-gray-600 uppercase' }, `En la mesa (${members.length})`),
      h('ul', { class: 'flex flex-wrap gap-1.5' }, members.map(([uid, name]) => memberChip(uid, name, table)))),
    h('div', { class: 'mt-auto flex gap-2 border-t border-gray-100 pt-4' },
      h('button', { type: 'button', class: 'btn-secondary flex-1 text-sm', onclick: () => shareCode(table) }, icon('share-nodes'), 'Invitar'),
      isOwner
        ? h('button', { type: 'button', class: 'btn-danger-soft flex-1', onclick: () => closeTable(table) }, icon('door-closed'), 'Cerrar mesa')
        : h('button', { type: 'button', class: 'btn-danger-soft flex-1', onclick: () => leaveTable(table) }, icon('receipt'), 'Pagar la cuenta')));
}

function render() {
  const grid = $('#bar-grid');
  if (!loaded) {
    grid.replaceChildren(...Array.from({ length: 3 }, () => h('div', { class: 'skeleton h-48' })));
    return;
  }
  if (tables.length === 0) {
    grid.replaceChildren(h('div', { class: 'empty-state' },
      h('div', { class: 'mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mustard-50 text-2xl text-mustard-ink' }, icon('people-group')),
      h('h2', { class: 'mb-1 text-lg font-bold text-gray-900' }, 'Aún no estás en ninguna mesa'),
      h('p', { class: 'mb-6 max-w-sm text-sm text-gray-600' }, 'Crea una y pasa el código a tus amigos, o únete con el código que te hayan enviado.'),
      h('div', { class: 'flex w-full max-w-sm flex-col gap-2 sm:flex-row' },
        h('button', { type: 'button', class: 'btn-primary flex-1', onclick: openCreateTable }, 'Crear mesa'),
        h('button', { type: 'button', class: 'btn-secondary flex-1', onclick: openJoinTable }, 'Tengo un código'))));
    return;
  }
  grid.replaceChildren(...tables.map(tableCard));
}

/* ---------- Acciones ---------- */

export function openCreateTable() {
  $('#create-table-form').reset();
  $('#create-table-form').hidden = false;
  $('#create-table-result').hidden = true;
  showError($('#create-table-error'), '');
  openDialog($('#create-table-dialog'));
}

let lastCreated = null;

async function createTable(event) {
  event.preventDefault();
  const name = $('#table-name').value.trim();
  const error = $('#create-table-error');
  if (!name) return showError(error, 'Ponle un nombre a la mesa.');

  const button = $('#create-table-submit');
  setBusy(button, true, 'Creando…');
  try {
    let code = newCode();
    for (let i = 0; i < 5 && (await getDoc(doc(db, 'tables', code))).exists(); i++) code = newCode();
    await setDoc(doc(db, 'tables', code), {
      name,
      ownerId: me.uid,
      ownerName: me.name,
      createdAt: serverTimestamp(),
      memberIds: [me.uid],
      members: { [me.uid]: me.name },
    });
    lastCreated = { id: code, name };
    $('#created-code').textContent = code;
    $('#create-table-form').hidden = true;
    $('#create-table-result').hidden = false;
  } catch (err) {
    showError(error, friendlyError(err));
  } finally {
    setBusy(button, false);
  }
}

export function openJoinTable() {
  $('#join-table-form').reset();
  showError($('#join-table-error'), '');
  openDialog($('#join-table-dialog'));
}

async function joinTable(event) {
  event.preventDefault();
  const code = cleanCode($('#join-code').value);
  const error = $('#join-table-error');
  if (code.length !== CODE_LENGTH) return showError(error, `El código tiene ${CODE_LENGTH} caracteres.`);

  const button = $('#join-table-submit');
  setBusy(button, true, 'Buscando mesa…');
  try {
    const snapshot = await getDoc(doc(db, 'tables', code));
    if (!snapshot.exists()) return showError(error, 'No hay ninguna mesa con ese código. Revísalo con quien te lo pasó.');
    if (snapshot.data().memberIds?.includes(me.uid)) {
      closeDialog($('#join-table-dialog'));
      return toast('Ya estabas en esa mesa');
    }
    await updateDoc(snapshot.ref, {
      memberIds: arrayUnion(me.uid),
      [`members.${me.uid}`]: me.name,
    });
    closeDialog($('#join-table-dialog'));
    toast(`Te has sentado en «${snapshot.data().name}» 🍻`);
  } catch (err) {
    showError(error, friendlyError(err));
  } finally {
    setBusy(button, false);
  }
}

async function leaveTable(table) {
  const ok = await confirmAction({
    title: `¿Pagar la cuenta en «${table.name}»?`,
    message: 'Saldrás de la mesa. Podrás volver con el código.',
    confirmLabel: 'Pagar y salir',
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, 'tables', table.id), {
      memberIds: arrayRemove(me.uid),
      [`members.${me.uid}`]: deleteField(),
    });
    toast('Cuenta pagada. ¡Hasta la próxima!');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  }
}

async function closeTable(table) {
  const others = (table.memberIds?.length ?? 1) - 1;
  const ok = await confirmAction({
    title: `¿Cerrar «${table.name}»?`,
    message: others
      ? `La mesa desaparecerá también para ${others} ${others === 1 ? 'persona' : 'personas'}. No se puede deshacer.`
      : 'La mesa desaparecerá. No se puede deshacer.',
    confirmLabel: 'Cerrar mesa',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'tables', table.id));
    toast('Mesa cerrada');
  } catch (error) {
    toast(friendlyError(error), { type: 'error' });
  }
}

/* ---------- Arranque ---------- */

let wired = false;

export function initTables(profile) {
  me = profile;
  tables = [];
  loaded = false;
  render();

  if (!wired) {
    wired = true;
    $('#create-table-form').addEventListener('submit', createTable);
    $('#join-table-form').addEventListener('submit', joinTable);
    $('#join-code').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
    $('#created-copy').addEventListener('click', () => lastCreated && copyText(lastCreated.id));
    $('#created-share').addEventListener('click', () => lastCreated && shareCode(lastCreated));
  }

  return onSnapshot(
    query(collection(db, 'tables'), where('memberIds', 'array-contains', me.uid)),
    (snapshot) => {
      tables = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      loaded = true;
      render();
    },
    (error) => toast(friendlyError(error), { type: 'error' }),
  );
}
