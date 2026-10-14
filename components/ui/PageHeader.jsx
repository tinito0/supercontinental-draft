import React from 'react';

/**
 * Header shared by every page: eyebrow (section), title, one-line description and actions on the right.
 * Renders the page's only <h1>.
 */
export function PageHeader({ eyebrow, title, description, actions, children, className = '' }) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2 text-sm text-ink-2 max-w-[65ch]">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

/** Section heading inside a page (h2) with optional trailing actions. */
export function SectionHeader({ title, description, actions, as: Tag = 'h2', className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <Tag className="section-title">{title}</Tag>
        {description && <p className="mt-1 text-xs text-ink-3 max-w-[65ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageHeader;
