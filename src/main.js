import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@fortawesome/fontawesome-free/css/regular.min.css';
import './style.css';

import { closeAccount, openAccount } from './account.js';
import { initAuth, logout } from './auth.js';
import { initBeers, openAddBeer } from './beers.js';
import { initModeration } from './moderation.js';
import { initTables, openCreateTable, openJoinTable } from './tables.js';
import { $$, confirmAction, wireDialogs } from './ui.js';

/* ---------- Navegación por pestañas con #hash (el botón atrás del móvil funciona) ---------- */

const VIEWS = ['inicio', 'bodega', 'bar', 'moderar'];

function showView() {
  const current = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  for (const view of $$('[data-view]')) view.hidden = view.dataset.view !== current;
  for (const link of $$('[data-nav]')) {
    if (link.dataset.nav === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', showView);

/* ---------- Acciones globales ---------- */

const ACTIONS = {
  'add-beer': openAddBeer,
  'create-table': openCreateTable,
  'join-table': openJoinTable,
  account: openAccount,
  logout: async () => {
    closeAccount();
    const ok = await confirmAction({ title: '¿Cerrar sesión?', message: 'Tendrás que volver a entrar con tu correo.', confirmLabel: 'Cerrar sesión' });
    if (ok) logout();
  },
};

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]');
  if (trigger) ACTIONS[trigger.dataset.action]?.();
});

/* ---------- Sesión ---------- */

let unsubscribers = [];

function stopListeners() {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
}

wireDialogs();
showView();

initAuth({
  onSignedIn(profile) {
    stopListeners();
    for (const el of $$('[data-user-name]')) el.textContent = profile.name;
    for (const el of $$('[data-user-email]')) el.textContent = profile.email;
    unsubscribers = [initBeers(profile), initTables(profile), initModeration(profile)];
    showView();
  },
  onSignedOut: stopListeners,
});
