import React from 'react';

/**
 * Page skeleton shared by every section (docs/DESIGN_SYSTEM.md): constrained width, consistent
 * vertical rhythm. Usage: <Page><PageHeader …/>{toolbar}{content}</Page>.
 * `fill` makes the page take the full height of the main area (marketplace grid, pitch editor).
 */
export function Page({ children, className = '', fill = false, as: Tag = 'div' }) {
  return (
    <Tag className={`mx-auto w-full max-w-page ${fill ? 'flex flex-col min-h-0 h-full gap-5' : 'space-y-6'} ${className}`}>
      {children}
    </Tag>
  );
}

export default Page;
