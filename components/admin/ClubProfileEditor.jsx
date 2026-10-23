import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImageOff, Plus, Trash2 } from 'lucide-react';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { useLeagueContent } from '../../hooks/useLeagueData.js';
import {
  CLUB_PROFILE_FIELDS, HONOUR_SCOPES, MAX_CHAPTERS, MAX_CLUB_SEASONS, MAX_ERA_LENGTH, MAX_HONOURS, MAX_PHOTO_URL_LENGTH,
  MAX_STORY_LENGTH, MAX_TITLE_LENGTH, SEASON_STATS, cleanPhotoUrl, clubChapters, clubStoryDocId, moveChapter, newClubChapter,
  newClubSeason, newHonour,
} from '../../utils/leagueContent.js';

/* Administración → Web pública → Clubes: la ficha (estadio, autoridades, títulos, campañas) y la historia de un club.
   Se guardan juntas porque viven en el mismo documento (utils/leagueContent.js normalizeClub). */

const emptyProfile = () => ({ ...Object.fromEntries(CLUB_PROFILE_FIELDS.map(([key]) => [key, ''])), stadiumPhotoUrl: '', honours: [], seasons: [] });

function fromSaved(content) {
  const saved = content?.profile || {};
  const base = emptyProfile();
  return {
    chapters: clubChapters(content).map(chapter => ({
      ...newClubChapter(), era: chapter.era, title: chapter.title, closing: chapter.closing, body: chapter.paragraphs.join('\n\n'),
    })),
    profile: {
      ...base,
      ...Object.fromEntries(Object.keys(base).filter(key => typeof saved[key] === 'string').map(key => [key, saved[key]])),
      honours: (saved.honours || []).map(item => ({ ...newHonour(), ...item, count: String(item.count ?? 1) })),
      seasons: (saved.seasons || []).map(item => ({ ...newClubSeason(), ...item })),
    },
  };
}

function PhotoPreview({ url }) {
  const clean = cleanPhotoUrl(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [clean]);
  if (!url) return null;
  if (clean === null) return <p className="text-sm text-danger-soft">Tiene que ser un link que empiece con https://.</p>;
  if (failed) {
    return (
      <p className="flex items-center gap-2 text-sm text-warning-soft">
        <ImageOff className="h-4 w-4" aria-hidden="true" /> No se pudo abrir la imagen. Usá el link directo a la foto (termina en .jpg, .png o .webp).
      </p>
    );
  }
  return <img src={clean} alt="Vista previa del estadio" className="aspect-[16/7] w-full rounded-xl object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function RowList({ title, help, rows, max, onAdd, addLabel, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="section-title">{title}</legend>
      <p className="text-sm text-ink-2">{help}</p>
      {rows.length > 0 && <ol className="space-y-3">{children}</ol>}
      <button type="button" className="btn btn-secondary min-h-11" onClick={onAdd} disabled={rows.length >= max}>
        <Plus className="h-4 w-4" aria-hidden="true" /> {addLabel}
      </button>
    </fieldset>
  );
}

function RemoveButton({ label, onClick }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon min-h-11 min-w-11 text-danger-soft" aria-label={label} onClick={onClick}>
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

/**
 * @param {{ teamId: string, teamName: string, onSave: (club: { body: string, profile: object }) => Promise<boolean>, renderSaveBar: Function }} props
 */
export function ClubProfileEditor({ teamId, teamName, onSave, renderSaveBar }) {
  const { content, loading, error } = useLeagueContent(clubStoryDocId(teamId));
  const saved = useMemo(() => fromSaved(content), [content]);
  const [form, setForm] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);

  // Carga lo guardado cuando cambia el club elegido o llega una versión nueva.
  useEffect(() => { setForm(saved); }, [teamId, saved]);

  if (loading) return <div className="skeleton h-96 rounded-xl" aria-label="Cargando ficha del club" />;
  if (error) return <Alert tone="danger" title={error} />;

  const setField = (key, value) => setForm(prev => ({ ...prev, profile: { ...prev.profile, [key]: value } }));
  const setRow = (list, id, patch) => setForm(prev => ({
    ...prev, profile: { ...prev.profile, [list]: prev.profile[list].map(row => (row.id === id ? { ...row, ...patch } : row)) },
  }));
  const addRow = (list, row) => setForm(prev => ({ ...prev, profile: { ...prev.profile, [list]: [...prev.profile[list], row] } }));
  const removeRow = (list, id) => setForm(prev => ({ ...prev, profile: { ...prev.profile, [list]: prev.profile[list].filter(row => row.id !== id) } }));
  const setChapter = (id, patch) => setForm(prev => ({ ...prev, chapters: prev.chapters.map(row => (row.id === id ? { ...row, ...patch } : row)) }));
  const moveChapterRow = (index, delta) => setForm(prev => ({ ...prev, chapters: moveChapter(prev.chapters, index, delta) }));
  const isDirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
  };

  const { profile } = form;
  return (
    <div className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="section-title">Ficha de {teamName}</legend>
        <p className="text-sm text-ink-2">Lo que aparece arriba de todo en la página del club. Lo que dejes vacío no se muestra.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CLUB_PROFILE_FIELDS.map(([key, label, max, placeholder]) => (
            <Field key={key} label={label}>
              <input className="input" value={profile[key]} maxLength={max} placeholder={placeholder} onChange={event => setField(key, event.target.value)} />
            </Field>
          ))}
        </div>
        <Field label="Foto del estadio" help="Pegá el link directo a una foto (https://…). Se muestra grande en la cabecera del club.">
          <input className="input" type="url" inputMode="url" value={profile.stadiumPhotoUrl} maxLength={MAX_PHOTO_URL_LENGTH}
            placeholder="https://…/estadio.jpg" onChange={event => setField('stadiumPhotoUrl', event.target.value)} />
        </Field>
        <PhotoPreview url={profile.stadiumPhotoUrl} />
      </fieldset>

      <RowList title="Palmarés" help="Títulos del club: de la Supercontinental, de su liga y copas nacionales, e internacionales."
        rows={profile.honours} max={MAX_HONOURS} addLabel="Agregar título" onAdd={() => addRow('honours', newHonour())}>
        {profile.honours.map((row, index) => (
          <li key={row.id} className="grid grid-cols-1 gap-3 rounded-xl border border-line/[0.12] bg-raised/40 p-4 sm:grid-cols-[10rem_minmax(0,1fr)_5rem_auto]">
            <Field label="Tipo">
              <select className="select" value={row.scope} onChange={event => setRow('honours', row.id, { scope: event.target.value })}>
                {HONOUR_SCOPES.map(scope => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
              </select>
            </Field>
            <Field label="Competición">
              <input className="input" value={row.name} maxLength={80} placeholder="Ej.: Liga Profesional" onChange={event => setRow('honours', row.id, { name: event.target.value })} />
            </Field>
            <Field label="Veces">
              <input className="input num" inputMode="numeric" value={row.count} maxLength={2} onChange={event => setRow('honours', row.id, { count: event.target.value })} />
            </Field>
            <div className="flex items-end"><RemoveButton label={`Quitar el título ${index + 1}`} onClick={() => removeRow('honours', row.id)} /></div>
            <div className="sm:col-span-4">
              <Field label="Años">
                <input className="input" value={row.years} maxLength={160} placeholder="Ej.: 2019, 2021, 2023" onChange={event => setRow('honours', row.id, { years: event.target.value })} />
              </Field>
            </div>
          </li>
        ))}
      </RowList>

      <RowList title="Campañas anteriores" help="Cómo le fue en cada temporada o torneo: «2025 · Supercontinental · Campeón», «2024 · Copa de Plata · Semifinal»."
        rows={profile.seasons} max={MAX_CLUB_SEASONS} addLabel="Agregar campaña" onAdd={() => addRow('seasons', newClubSeason())}>
        {profile.seasons.map((row, index) => (
          <li key={row.id} className="grid grid-cols-1 gap-3 rounded-xl border border-line/[0.12] bg-raised/40 p-4 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field label="Temporada">
              <input className="input" value={row.season} maxLength={40} placeholder="2025" onChange={event => setRow('seasons', row.id, { season: event.target.value })} />
            </Field>
            <Field label="Competición">
              <input className="input" value={row.competition} maxLength={80} placeholder="Supercontinental League" onChange={event => setRow('seasons', row.id, { competition: event.target.value })} />
            </Field>
            <Field label="Resultado">
              <input className="input" value={row.result} maxLength={120} placeholder="Campeón" onChange={event => setRow('seasons', row.id, { result: event.target.value })} />
            </Field>
            <div className="flex items-end"><RemoveButton label={`Quitar la campaña ${index + 1}`} onClick={() => removeRow('seasons', row.id)} /></div>
            <div className="grid grid-cols-3 gap-3 sm:col-span-4 sm:grid-cols-6">
              {SEASON_STATS.map(([key, short, long]) => (
                <Field key={key} label={short} help={long}>
                  <input className="input num" inputMode="numeric" value={row[key] ?? ''} maxLength={3} aria-label={long}
                    onChange={event => setRow('seasons', row.id, { [key]: event.target.value })} />
                </Field>
              ))}
            </div>
          </li>
        ))}
      </RowList>

      <RowList title="Historia del club" max={MAX_CHAPTERS} addLabel="Agregar capítulo" rows={form.chapters}
        help="Cómo nació, su identidad, sus momentos en la liga. Cada capítulo se muestra como una tarjeta: la época y el título a la izquierda, el relato a la derecha. Separá los párrafos con una línea en blanco. El último capítulo puede marcarse como cierre, destacado."
        onAdd={() => setForm(prev => ({ ...prev, chapters: [...prev.chapters, newClubChapter()] }))}>
        {form.chapters.map((row, index) => (
          <li key={row.id} className="grid grid-cols-1 gap-3 rounded-xl border border-line/[0.12] bg-raised/40 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
            <Field label="Época">
              <input className="input" value={row.era} maxLength={MAX_ERA_LENGTH} placeholder="Ej.: 1913" onChange={event => setChapter(row.id, { era: event.target.value })} />
            </Field>
            <Field label="Título">
              <input className="input" value={row.title} maxLength={MAX_TITLE_LENGTH} placeholder="Ej.: La fundación" onChange={event => setChapter(row.id, { title: event.target.value })} />
            </Field>
            <div className="flex items-end gap-1">
              <button type="button" className="btn btn-ghost btn-icon min-h-11 min-w-11" aria-label={`Subir el capítulo ${index + 1}`}
                disabled={index === 0} onClick={() => moveChapterRow(index, -1)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" className="btn btn-ghost btn-icon min-h-11 min-w-11" aria-label={`Bajar el capítulo ${index + 1}`}
                disabled={index === form.chapters.length - 1} onClick={() => moveChapterRow(index, 1)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
              <RemoveButton label={`Quitar el capítulo ${index + 1}`} onClick={() => setForm(prev => ({ ...prev, chapters: prev.chapters.filter(item => item.id !== row.id) }))} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Field label="Texto" help={`${row.body.length.toLocaleString('es-AR')} / ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.`}>
                <textarea className="input min-h-[10rem] py-2 leading-relaxed" value={row.body} maxLength={MAX_STORY_LENGTH}
                  onChange={event => setChapter(row.id, { body: event.target.value })} />
              </Field>
              {index === form.chapters.length - 1 && (
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={row.closing} onChange={event => setChapter(row.id, { closing: event.target.checked })} />
                  Capítulo de cierre (ancho completo, destacado)
                </label>
              )}
            </div>
          </li>
        ))}
      </RowList>

      {renderSaveBar({ isDirty, isSaving, onSave: handleSave, publicHref: `/equipos/${teamId}` })}
    </div>
  );
}

export default ClubProfileEditor;
