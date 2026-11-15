// Denuncias de publicaciones y comentarios.
// El ID de cada denuncia es "quién__qué": así nadie puede denunciar dos veces lo mismo.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { currentProfile } from './auth.js';
import { db } from './firebase.js';
import { $, $$, closeDialog, openDialog, setBusy, showError, toast } from './ui.js';

let target = null;

/** target: { beer, reviewUid?, reviewName?, reviewText? } */
export function openReport(next) {
  target = next;
  $('#report-form').reset();
  showError($('#report-error'), '');
  $('#report-target').textContent = next.reviewUid
    ? `Comentario de ${next.reviewName || 'un usuario'} en «${next.beer.name}».`
    : `Publicación «${next.beer.name}».`;
  openDialog($('#report-dialog'));
}

async function sendReport(event) {
  event.preventDefault();
  const reason = $$('input[name="reason"]', event.currentTarget).find((r) => r.checked)?.value;
  const error = $('#report-error');
  if (!reason) return showError(error, 'Elige un motivo.');

  const me = currentProfile();
  const reviewUid = target.reviewUid ?? '';
  const id = `${me.uid}__${target.beer.id}__${reviewUid || 'post'}`;
  const button = $('#report-submit');
  setBusy(button, true, 'Enviando…');
  try {
    await setDoc(doc(db, 'reports', id), {
      beerId: target.beer.id,
      beerName: target.beer.name,
      reviewUid,
      reviewName: target.reviewName ?? '',
      reviewText: (target.reviewText ?? '').slice(0, 500),
      reason,
      details: $('#report-details').value.trim(),
      reporterUid: me.uid,
      createdAt: serverTimestamp(),
    });
    closeDialog($('#report-dialog'));
    toast('Gracias. Lo revisaremos lo antes posible.');
  } catch (err) {
    // Si ya existe, las reglas impiden sobrescribirla: es que ya lo había denunciado.
    if (err?.code === 'permission-denied') {
      closeDialog($('#report-dialog'));
      toast('Ya lo habías denunciado. Lo estamos revisando.');
    } else {
      showError(error, 'No se ha podido enviar. Inténtalo de nuevo.');
    }
  } finally {
    setBusy(button, false);
  }
}

$('#report-form').addEventListener('submit', sendReport);
