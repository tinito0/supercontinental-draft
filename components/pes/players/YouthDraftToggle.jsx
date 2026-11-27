import React, { useState } from 'react';
import { Card, ErrorText } from '../PesUi.jsx';
import { Button } from '../../ui/Button.jsx';
import { candidateCheck, editedRating, isEditedOvrInRange, YOUTH_DRAFT_EDITED_MIN_OVR, YOUTH_DRAFT_EDITED_MAX_OVR } from '../../../utils/youthDraft.js';
import { saveCandidates } from '../../../services/youthDraftService.js';

/**
 * «Promesa del draft» on a Player.bin sheet (Super Admin). Marking only adds the id to the candidate list; the
 * prospect reaches the market when the list is published from «Promesas». Eligibility uses the original game data,
 * and the rating shown is the sheet as it is now in this working copy.
 */
export function YouthDraftToggle({ playerId, get, appPlayer, draft }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const candidates = Array.isArray(draft?.candidates) ? draft.candidates.map(Number) : [];
  const isMarked = candidates.includes(Number(playerId));
  const published = (Array.isArray(draft?.pool) ? draft.pool : []).find(entry => Number(entry.id) === Number(playerId));
  const { eligible, reason } = candidateCheck(appPlayer);
  const rating = editedRating(get);

  const toggle = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveCandidates(isMarked ? candidates.filter(id => id !== Number(playerId)) : [...candidates, Number(playerId)]);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const ratingNote = rating == null
    ? 'No se pudo calcular la media de esta ficha.'
    : isEditedOvrInRange(rating)
      ? `Media con la ficha editada: ${rating}.`
      : `Media con la ficha editada: ${rating}. El reglamento pide ${YOUTH_DRAFT_EDITED_MIN_OVR} o más.`;

  return (
    <Card title="Promesa del draft"
      description={eligible ? ratingNote : reason}
      actions={(
        <Button size="sm" variant={isMarked ? 'secondary' : 'primary'} className="min-h-11" loading={saving}
          disabled={!eligible && !isMarked} title={!eligible && !isMarked ? reason : undefined} onClick={toggle}>
          {isMarked ? 'Quitar de promesas' : 'Marcar como promesa'}
        </Button>
      )}>
      {published && (
        <p className="text-sm text-ink-3">
          Publicada con media <span className="num text-ink-2">{published.ovr}</span>
          {rating != null && rating !== Number(published.ovr) && <> · la ficha cambió: volvé a publicar desde «Promesas»</>}.
        </p>
      )}
      <ErrorText error={error} className="mt-3" />
    </Card>
  );
}
