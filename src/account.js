// "Mi cuenta": datos, cerrar sesión, textos legales y borrado completo de la cuenta (derecho de supresión).

import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { arrayRemove, deleteDoc, deleteField, doc, updateDoc } from 'firebase/firestore';
import { authMessage, currentProfile } from './auth.js';
import { deleteBeer, getBeers, removeRating } from './beers.js';
import { auth, db } from './firebase.js';
import { getTables } from './tables.js';
import { $, closeDialog, openDialog, setBusy, showError, toast } from './ui.js';

export function openAccount() {
  $('#delete-account').open = false;
  $('#delete-account-form').reset();
  showError($('#delete-account-error'), '');
  openDialog($('#account-dialog'));
}

export function closeAccount() {
  closeDialog($('#account-dialog'));
}

async function deleteAccount(event) {
  event.preventDefault();
  const password = $('#delete-password').value;
  const error = $('#delete-account-error');
  if (!password) return showError(error, 'Escribe tu contraseña.');

  const me = currentProfile();
  const user = auth.currentUser;
  const button = $('#delete-account-submit');
  setBusy(button, true, 'Borrando…');
  try {
    // Firebase exige haber entrado hace poco para borrar una cuenta.
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));

    const beers = getBeers();
    // 1. Mis publicaciones (con sus fotos)
    for (const beer of beers.filter((b) => b.createdBy === me.uid)) await deleteBeer(beer);
    // 2. Mis notas en publicaciones de otros
    for (const beer of beers.filter((b) => b.createdBy !== me.uid && b.ratings?.[me.uid])) {
      await removeRating(beer.id, me.uid);
    }
    // 3. Mesas: cierro las mías y salgo de las demás
    for (const table of getTables()) {
      if (table.ownerId === me.uid) await deleteDoc(doc(db, 'tables', table.id));
      else await updateDoc(doc(db, 'tables', table.id), { memberIds: arrayRemove(me.uid), [`members.${me.uid}`]: deleteField() });
    }
    // 4. Perfil y cuenta
    await deleteDoc(doc(db, 'members', me.uid));
    await deleteUser(user);

    closeAccount();
    toast('Tu cuenta y tus datos se han borrado. ¡Salud!');
  } catch (err) {
    showError(error, err?.code?.startsWith('auth/') ? authMessage(err) : 'No se ha podido borrar todo. Inténtalo de nuevo.');
  } finally {
    setBusy(button, false);
  }
}

$('#delete-account-form').addEventListener('submit', deleteAccount);
