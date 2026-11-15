// Acceso abierto: cualquiera crea su cuenta con correo y contraseña.
// Cada usuario tiene además un perfil en /members/{uid} (nombre visible, mayoría de edad y
// aceptación de condiciones). Para publicar hay que confirmar el correo.

import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
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
    subtitle: 'Tu diario de cervezas',
  },
  register: {
    fields: ['name', 'email', 'password', 'consent'],
    submit: 'Crear cuenta',
    subtitle: 'Gratis y en menos de un minuto',
  },
  activate: {
    fields: ['name', 'consent'],
    submit: 'Continuar',
    subtitle: 'Un último paso: ¿cómo quieres que te vean los demás?',
  },
};

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-email': 'Ese correo no parece válido.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo. Prueba a entrar.',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  'permission-denied': 'No se ha podido crear tu perfil. Revisa los datos.',
};

let mode = 'login';
let registering = false;
let profile = null;

const screen = $('#auth-screen');
const form = $('#auth-form');
const errorEl = $('#auth-error');
const submit = $('#auth-submit');
const field = (name) => $(`#auth-${name}`);

/* ---------- Formulario de acceso ---------- */

function setMode(next) {
  mode = next;
  const config = MODES[next];
  for (const wrapper of $$('[data-field]', form)) {
    const visible = config.fields.includes(wrapper.dataset.field);
    wrapper.hidden = !visible;
    for (const input of $$('input', wrapper)) input.required = visible;
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
    adult: field('adult').checked,
    terms: field('terms').checked,
  };
}

function validate(values) {
  const needed = MODES[mode].fields;
  if (needed.includes('name') && !values.name) return 'Escribe tu nombre o apodo.';
  if (needed.includes('email') && !values.email) return 'Escribe tu correo.';
  if (needed.includes('password') && values.password.length < 6) return 'La contraseña necesita al menos 6 caracteres.';
  if (needed.includes('consent') && !values.adult) return 'Beerlist es solo para mayores de 18 años.';
  if (needed.includes('consent') && !values.terms) return 'Tienes que aceptar las condiciones de uso y la política de privacidad.';
  return '';
}

export function authMessage(error) {
  const code = error?.code ?? '';
  const key = Object.keys(AUTH_ERRORS).find((k) => code.includes(k));
  return key ? AUTH_ERRORS[key] : 'No se ha podido completar. Inténtalo de nuevo.';
}

/** Crea el perfil público del usuario con su consentimiento. */
function createProfile(uid, name) {
  return setDoc(doc(db, 'members', uid), {
    name,
    adult: true,
    acceptedTermsAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

const verifySettings = () => ({ url: location.origin });

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
        await createProfile(user.uid, values.name);
      } catch (error) {
        await deleteUser(user).catch(() => {}); // si falla el perfil, no dejamos cuentas a medias
        throw error;
      } finally {
        registering = false;
      }
      sendEmailVerification(user, verifySettings()).catch(() => {});
      await resolveUser(user);
      toast('¡Bienvenido! Revisa tu correo para confirmar la cuenta.');
    } else {
      await createProfile(auth.currentUser.uid, values.name);
      await resolveUser(auth.currentUser);
    }
  } catch (error) {
    showError(errorEl, authMessage(error));
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
    showError(errorEl, authMessage(error));
  }
}

/* ---------- Verificación de correo ---------- */

function renderVerification() {
  $('#verify-banner').hidden = !profile || profile.verified;
}

/** Úsalo antes de cualquier acción que publique algo. */
export function canPublish() {
  if (profile?.verified) return true;
  toast('Confirma tu correo para poder publicar. Mira el aviso de arriba.', { type: 'error' });
  $('#verify-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
  return false;
}

async function resendVerification(event) {
  const button = event.currentTarget;
  setBusy(button, true, 'Enviando…');
  try {
    await sendEmailVerification(auth.currentUser, verifySettings());
    toast(`Enlace enviado a ${auth.currentUser.email}. Mira también en spam.`);
  } catch (error) {
    toast(authMessage(error), { type: 'error' });
  } finally {
    setBusy(button, false);
  }
}

async function checkVerification(event) {
  const button = event.currentTarget;
  setBusy(button, true, 'Comprobando…');
  try {
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true); // el permiso para publicar viaja en el token
      profile.verified = true;
      renderVerification();
      toast('¡Correo confirmado! Ya puedes publicar.');
    } else {
      toast('Todavía no aparece como confirmado. Pulsa el enlace del correo y vuelve a probar.', { type: 'error' });
    }
  } finally {
    setBusy(button, false);
  }
}

/* ---------- Sesión ---------- */

let onSignedIn = () => {};
let onSignedOut = () => {};

async function resolveUser(user) {
  $('#splash').hidden = true;
  if (!user) {
    profile = null;
    if (mode === 'activate') setMode('login');
    screen.hidden = false;
    $('#app').hidden = true;
    onSignedOut();
    return;
  }

  const snapshot = await getDoc(doc(db, 'members', user.uid)).catch(() => null);
  if (!snapshot?.exists()) {
    // Cuenta de la versión anterior (sin perfil): pedimos nombre y consentimiento una vez.
    setMode('activate');
    screen.hidden = false;
    $('#app').hidden = true;
    return;
  }

  const admin = await getDoc(doc(db, 'admins', user.uid)).then((s) => s.exists()).catch(() => false);

  profile = {
    uid: user.uid,
    email: user.email,
    name: snapshot.data().name,
    verified: user.emailVerified,
    isAdmin: admin,
  };
  screen.hidden = true;
  $('#app').hidden = false;
  form.reset();
  renderVerification();
  onSignedIn(profile);
}

export const currentProfile = () => profile;

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
  $('#verify-resend').addEventListener('click', resendVerification);
  $('#verify-check').addEventListener('click', checkVerification);
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
