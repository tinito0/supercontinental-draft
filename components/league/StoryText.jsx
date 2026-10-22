import React from 'react';
import { FileText } from 'lucide-react';
import { toParagraphs } from '../../utils/leagueContent.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';

/**
 * A text written in Administración → Web pública, as paragraphs (plain text, never HTML).
 * Shows a skeleton while loading and a clear empty state until the admin writes it.
 */
export function StoryText({ body, loading, error, emptyTitle, emptyDescription, limit, className = '' }) {
  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) {
    return (
      <div className="max-w-[68ch] space-y-3" aria-hidden="true">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-11/12" />
        <div className="skeleton h-4 w-4/5" />
      </div>
    );
  }

  const paragraphs = toParagraphs(body);
  if (paragraphs.length === 0) return <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />;

  const shown = limit ? paragraphs.slice(0, limit) : paragraphs;
  return (
    <div className={`max-w-[68ch] space-y-4 text-lg leading-relaxed text-ink-2 ${className}`}>
      {shown.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  );
}

export default StoryText;
