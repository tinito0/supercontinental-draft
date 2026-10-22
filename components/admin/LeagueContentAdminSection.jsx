import React, { memo, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, ExternalLink, History, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { auth } from '../../config/firebase.js';
import { Tabs } from '../ui/Tabs.jsx';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { useLeagueContent } from '../../hooks/useLeagueData.js';
import { isTeamApproved } from '../../supabase/functions/_shared/membership.js';
import { saveClubStory, saveLeagueHistory, saveSeasonRules } from '../../services/leagueContentService.js';
import { LeagueEditorsPanel } from './LeagueEditorsPanel.jsx';
import {
  LEAGUE_HISTORY_DOC,
  MAX_STORY_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_SEASON_LENGTH,
  SEASON_RULES_DOC,
  clubStoryDocId,
  moveChapter,
  newChapter,
} from '../../utils/leagueContent.js';

/* Administración → Web pública: the texts of the public league site (screens/league/). */

const SECTIONS = [
  { id: 'liga', label: 'Historia de la liga', icon: History },
  { id: 'clubes', label: 'Historia de los clubes', icon: Shield },
  { id: 'reglamento', label: 'Reglamento', icon: BookOpen },
];

const PARAGRAPH_HELP = 'Separá los párrafos con una línea en blanco. Se publica como texto, sin formato.';

/** Runs a save and reports it; returns whether it worked. */
async function runSave(action, showStatusMessage, successMessage) {
  try {
    const result = await action();
    if (!result.ok) {
      showStatusMessage?.('error', result.error);
      return false;
    }
    showStatusMessage?.('success', successMessage);
    return true;
  } catch (error) {
    console.error('[LeagueContentAdminSection]', error);
    showStatusMessage?.('error', 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
    return false;
  }
}

function SaveBar({ isDirty, isSaving, onSave, publicHref }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/10 pt-4">
      <a href={publicHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-11">
        <ExternalLink className="h-4 w-4" aria-hidden="true" /> Ver en la web
      </a>
      <button type="button" className="btn btn-primary min-h-11" onClick={onSave} disabled={!isDirty || isSaving}
        title={isDirty ? undefined : 'No hay cambios para guardar'}>
        <Save className="h-4 w-4" aria-hidden="true" /> {isSaving ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

/** One long text (league or club history) bound to a league_content document. */
function StoryEditor({ docId, label, help, publicHref, onSave, showStatusMessage }) {
  const { content, loading, error } = useLeagueContent(docId);
  const savedBody = content?.body || '';
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load the saved text when the document (or the selected club) changes.
  useEffect(() => { setBody(savedBody); }, [docId, savedBody]);

  if (loading) return <div className="skeleton h-64 rounded-xl" aria-label="Cargando texto" />;
  if (error) return <Alert tone="danger" title={error} />;

  const handleSave = async () => {
    setIsSaving(true);
    await runSave(() => onSave(body), showStatusMessage, 'Texto guardado: ya se ve en la web.');
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      <Field label={label} help={`${help || PARAGRAPH_HELP} ${body.length.toLocaleString('es-AR')} / ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.`}>
        <textarea className="input min-h-[18rem] py-2 leading-relaxed" value={body} maxLength={MAX_STORY_LENGTH}
          onChange={event => setBody(event.target.value)} />
      </Field>
      <SaveBar isDirty={body.trim() !== savedBody.trim()} isSaving={isSaving} onSave={handleSave} publicHref={publicHref} />
    </div>
  );
}

function ClubStories({ allTeams, showStatusMessage }) {
  const teams = useMemo(() => Object.entries(allTeams || {})
    .map(([id, team]) => ({ id, ...team }))
    .filter(team => isTeamApproved(team) && String(team.teamName || '').trim())
    .sort((a, b) => a.teamName.localeCompare(b.teamName, 'es')), [allTeams]);
  const [teamId, setTeamId] = useState('');
  const selectedId = teamId || teams[0]?.id || '';

  if (teams.length === 0) return <EmptyState icon={Shield} title="No hay equipos aprobados" description="Los clubes aparecen acá cuando se aprueban en Equipos y usuarios." />;

  return (
    <div className="space-y-4">
      <Field label="Club">
        <select className="select" value={selectedId} onChange={event => setTeamId(event.target.value)}>
          {teams.map(team => <option key={team.id} value={team.id}>{team.teamName}</option>)}
        </select>
      </Field>
      <StoryEditor
        docId={clubStoryDocId(selectedId)}
        label="Historia del club"
        help={`Cómo nació el club, su identidad, sus momentos en la liga. ${PARAGRAPH_HELP}`}
        publicHref={`/equipos/${selectedId}`}
        onSave={body => saveClubStory(selectedId, body, auth?.currentUser?.uid)}
        showStatusMessage={showStatusMessage}
      />
    </div>
  );
}

function SeasonRulesEditor({ showStatusMessage }) {
  const { content, loading, error } = useLeagueContent(SEASON_RULES_DOC);
  const saved = useMemo(() => ({ season: content?.season || '', chapters: content?.chapters || [] }), [content]);
  const [season, setSeason] = useState('');
  const [chapters, setChapters] = useState([]);
  const [baseline, setBaseline] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load what is saved (or one empty chapter to start) and remember it to tell unsaved changes apart.
  useEffect(() => {
    const initialChapters = saved.chapters.length ? saved.chapters : [newChapter()];
    setSeason(saved.season);
    setChapters(initialChapters);
    setBaseline(JSON.stringify({ season: saved.season, chapters: initialChapters }));
  }, [saved]);

  if (loading) return <div className="skeleton h-64 rounded-xl" aria-label="Cargando reglamento" />;
  if (error) return <Alert tone="danger" title={error} />;

  const updateChapter = (id, patch) => setChapters(list => list.map(chapter => (chapter.id === id ? { ...chapter, ...patch } : chapter)));
  const isDirty = JSON.stringify({ season, chapters }) !== baseline;

  const handleSave = async () => {
    setIsSaving(true);
    await runSave(() => saveSeasonRules({ season, chapters }, auth?.currentUser?.uid), showStatusMessage, 'Reglamento guardado: ya se ve en la web.');
    setIsSaving(false);
  };

  return (
    <div className="space-y-5">
      <Field label="Temporada" help="Se muestra arriba del reglamento, por ejemplo «Temporada 2026».">
        <input className="input" value={season} maxLength={MAX_SEASON_LENGTH} onChange={event => setSeason(event.target.value)} />
      </Field>

      <ol className="space-y-3">
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className="space-y-3 rounded-xl border border-line/[0.12] bg-raised/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Capítulo <span className="num">{index + 1}</span></span>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Subir el capítulo ${index + 1}`}
                  disabled={index === 0} onClick={() => setChapters(list => moveChapter(list, index, -1))}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Bajar el capítulo ${index + 1}`}
                  disabled={index === chapters.length - 1} onClick={() => setChapters(list => moveChapter(list, index, 1))}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-ghost btn-icon text-danger-soft" aria-label={`Quitar el capítulo ${index + 1}`}
                  onClick={() => setChapters(list => list.filter(item => item.id !== chapter.id))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <Field label="Título">
              <input className="input" value={chapter.title} maxLength={MAX_TITLE_LENGTH} placeholder="Ej.: Formato de la competencia"
                onChange={event => updateChapter(chapter.id, { title: event.target.value })} />
            </Field>
            <Field label="Texto" help={PARAGRAPH_HELP}>
              <textarea className="input min-h-[10rem] py-2 leading-relaxed" value={chapter.body} maxLength={MAX_STORY_LENGTH}
                onChange={event => updateChapter(chapter.id, { body: event.target.value })} />
            </Field>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn-secondary min-h-11" onClick={() => setChapters(list => [...list, newChapter()])}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Agregar capítulo
      </button>

      <SaveBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} publicHref="/reglamento" />
    </div>
  );
}

export const LeagueContentAdminSection = memo(function LeagueContentAdminSection({ allTeams, showStatusMessage, canManageEditors = false }) {
  const [section, setSection] = useState('liga');

  return (
    <section className="panel space-y-5 p-5" aria-labelledby="league-content-title">
      <div>
        <h3 id="league-content-title" className="section-title">Web pública de la liga</h3>
        <p className="mt-1 text-xs text-ink-3">
          Lo que se ve en la portada del sitio. Cada texto se publica al guardarlo; si queda vacío, la web muestra que todavía no se cargó.
        </p>
      </div>
      <Tabs tabs={SECTIONS} value={section} onChange={setSection} label="Textos de la web pública" />
      {section === 'liga' && (
        <StoryEditor
          docId={LEAGUE_HISTORY_DOC}
          label="Historia de la liga"
          help={`Cómo surgió la idea, quiénes la armaron y cómo fue creciendo. ${PARAGRAPH_HELP}`}
          publicHref="/historia"
          onSave={body => saveLeagueHistory(body, auth?.currentUser?.uid)}
          showStatusMessage={showStatusMessage}
        />
      )}
      {section === 'clubes' && <ClubStories allTeams={allTeams} showStatusMessage={showStatusMessage} />}
      {section === 'reglamento' && <SeasonRulesEditor showStatusMessage={showStatusMessage} />}
      {canManageEditors && <LeagueEditorsPanel allTeams={allTeams} showStatusMessage={showStatusMessage} />}
    </section>
  );
});

export default LeagueContentAdminSection;
