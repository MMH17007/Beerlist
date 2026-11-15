// Utilidades de interfaz compartidas. Todo el texto de usuario entra como texto, nunca como HTML.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Crea elementos del DOM de forma segura: h('p', { class: 'x' }, 'texto', otroNodo) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export const icon = (name, extra = '', style = 'solid') =>
  h('i', { class: `fa-${style} fa-${name} ${extra}`.trim(), 'aria-hidden': 'true' });

/* ---------- Diálogos ---------- */

export function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

/** Cierre con botón [data-close] o tocando fuera. La tecla Esc ya la gestiona <dialog>. */
export function wireDialogs() {
  for (const dialog of $$('dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-close]')) closeDialog(dialog);
    });
  }
}

/** Sustituto accesible de confirm(). Devuelve una promesa con true/false. */
export function confirmAction({ title, message, confirmLabel = 'Confirmar' }) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-message').textContent = message;
  const ok = $('#confirm-ok');
  const cancel = $('#confirm-cancel');
  ok.textContent = confirmLabel;

  return new Promise((resolve) => {
    const finish = (value) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onCancel);
      closeDialog(dialog);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('close', onCancel);
    openDialog(dialog);
    cancel.focus();
  });
}

/* ---------- Avisos ---------- */

export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const el = h('div', { class: `toast ${type === 'error' ? 'is-error' : ''}`, role: type === 'error' ? 'alert' : 'status' },
    icon(type === 'error' ? 'circle-exclamation' : 'circle-check'), message);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), duration);
}

export function showError(el, message) {
  el.textContent = message;
  el.hidden = !message;
}

/** Bloquea un botón mientras se hace una operación y muestra el progreso. */
export function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label ??= button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.replaceChildren(icon('spinner', 'fa-spin'), ' ', label ?? 'Un momento…');
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.label) button.innerHTML = button.dataset.label;
    delete button.dataset.label;
  }
}

/* ---------- Formato ---------- */

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const UNITS = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60],
];

export function timeAgo(timestamp) {
  const date = timestamp?.toDate?.() ?? (timestamp ? new Date(timestamp) : null);
  if (!date) return 'ahora mismo';
  const seconds = (date.getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'ahora mismo';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado');
  } catch {
    toast('No se ha podido copiar. Mantén pulsado el código para copiarlo.', { type: 'error' });
  }
}

export function friendlyError(error) {
  const code = error?.code ?? '';
  if (code.includes('permission-denied')) return 'No tienes permiso para hacer eso.';
  if (code.includes('unavailable') || code.includes('network')) return 'Sin conexión. Inténtalo de nuevo en un momento.';
  return error?.message || 'Algo ha fallado. Inténtalo de nuevo.';
}
