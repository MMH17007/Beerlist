// Acceso con código de invitación.
// El código NO está en este archivo: vive en Firestore (config/invite) y solo lo comprueban
// las reglas de seguridad. Así no se puede leer mirando el código de la web ni el repo.

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { $, $$, setBusy, showError, toast } from './ui.js';

const MODES = {
  login: {
    fields: ['email', 'password'],
    submit: 'Entrar',
    subtitle: 'Acceso exclusivo para amigos',
  },
  register: {
    fields: ['name', 'email', 'password', 'code'],
    submit: 'Crear cuenta',
    subtitle: 'Necesitas el código que te ha pasado el grupo',
  },
  activate: {
    fields: ['name', 'code'],
    submit: 'Activar cuenta',
    subtitle: 'Tu cuenta ya existe. Solo falta el código de invitación.',
  },
};

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'Ese correo no parece válido.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Prueba a entrar.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  'permission-denied': 'Código de invitación incorrecto.',
};

let mode = 'login';
let registering = false;

const screen = $('#auth-screen');
const form = $('#auth-form');
const errorEl = $('#auth-error');
const submit = $('#auth-submit');
const field = (name) => $(`#auth-${name}`);

function setMode(next) {
  mode = next;
  const config = MODES[next];
  for (const wrapper of $$('[data-field]', form)) {
    const visible = config.fields.includes(wrapper.dataset.field);
    wrapper.hidden = !visible;
    wrapper.querySelector('input').required = visible;
  }
  for (const tab of $$('#auth-tabs [data-mode]')) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === next));
  }
  $('#auth-tabs').hidden = next === 'activate';
  $('#auth-forgot').hidden = next !== 'login';
  $('#auth-switch-account').hidden = next !== 'activate';
  $('#auth-subtitle').textContent = config.subtitle;
  field('password').autocomplete = next === 'register' ? 'new-password' : 'current-password';
  submit.textContent = config.submit;
  showError(errorEl, '');
}

function readValues() {
  return {
    name: field('name').value.trim(),
    email: field('email').value.trim(),
    password: field('password').value,
    code: field('code').value.trim(),
  };
}

function validate(values) {
  const needed = MODES[mode].fields;
  if (needed.includes('name') && !values.name) return 'Escribe tu nombre o apodo.';
  if (needed.includes('email') && !values.email) return 'Escribe tu correo.';
  if (needed.includes('password') && values.password.length < 6) return 'La contraseña necesita al menos 6 caracteres.';
  if (needed.includes('code') && !values.code) return 'Escribe el código de invitación.';
  return '';
}

function messageFor(error) {
  const code = error?.code ?? '';
  const key = Object.keys(AUTH_ERRORS).find((k) => code.includes(k));
  return key ? AUTH_ERRORS[key] : 'No se ha podido completar. Inténtalo de nuevo.';
}

/** Crea el perfil de miembro. Las reglas solo lo permiten si el código coincide con config/invite. */
function activateMembership(uid, name, code) {
  return setDoc(doc(db, 'members', uid), { name, inviteCode: code, createdAt: serverTimestamp() });
}

async function handleSubmit(event) {
  event.preventDefault();
  const values = readValues();
  const problem = validate(values);
  if (problem) return showError(errorEl, problem);

  setBusy(submit, true);
  showError(errorEl, '');
  try {
    if (mode === 'login') {
      await signInWithEmailAndPassword(auth, values.email, values.password);
    } else if (mode === 'register') {
      registering = true;
      const { user } = await createUserWithEmailAndPassword(auth, values.email, values.password);
      try {
        await activateMembership(user.uid, values.name, values.code);
      } catch (error) {
        await deleteUser(user).catch(() => {}); // sin código válido no dejamos cuentas huérfanas
        throw error;
      } finally {
        registering = false;
      }
      await resolveUser(user);
    } else {
      await activateMembership(auth.currentUser.uid, values.name, values.code);
      await resolveUser(auth.currentUser);
    }
  } catch (error) {
    showError(errorEl, messageFor(error));
  } finally {
    setBusy(submit, false);
  }
}

async function handleForgot() {
  const email = field('email').value.trim();
  if (!email) {
    showError(errorEl, 'Escribe tu correo arriba y vuelve a pulsar.');
    field('email').focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Te hemos enviado un correo para cambiar la contraseña.');
  } catch (error) {
    showError(errorEl, messageFor(error));
  }
}

let onSignedIn = () => {};
let onSignedOut = () => {};

function hideSplash() {
  $('#splash').hidden = true;
}

async function resolveUser(user) {
  hideSplash();
  if (!user) {
    if (mode === 'activate') setMode('login');
    screen.hidden = false;
    $('#app').hidden = true;
    onSignedOut();
    return;
  }

  const snapshot = await getDoc(doc(db, 'members', user.uid)).catch(() => null);
  if (!snapshot?.exists()) {
    // Cuenta creada antes del sistema seguro, o registro a medias: pedimos el código.
    setMode('activate');
    screen.hidden = false;
    $('#app').hidden = true;
    return;
  }

  screen.hidden = true;
  $('#app').hidden = false;
  form.reset();
  onSignedIn({ uid: user.uid, email: user.email, name: snapshot.data().name });
}

export function logout() {
  return signOut(auth);
}

export function initAuth(handlers) {
  onSignedIn = handlers.onSignedIn;
  onSignedOut = handlers.onSignedOut;

  setMode('login');
  form.addEventListener('submit', handleSubmit);
  for (const tab of $$('#auth-tabs [data-mode]')) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  }
  $('#auth-forgot').addEventListener('click', handleForgot);
  $('#auth-switch-account').addEventListener('click', logout);
  $('#auth-toggle-password').addEventListener('click', (event) => {
    const input = field('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    event.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    event.currentTarget.querySelector('i').className = `fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}`;
  });

  onAuthStateChanged(auth, (user) => {
    if (registering) return; // el registro termina él mismo cuando el perfil está creado
    resolveUser(user);
  });
}
