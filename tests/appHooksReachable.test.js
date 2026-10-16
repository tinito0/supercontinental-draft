// Regression: the cart and roster sync effects once sat after App's final `return (...)` in app.jsx and
// never ran, so bought players never reached the buyer's squad. No hook may follow App's JSX return.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('app.jsx', () => {
  it('declares no hooks after the App component returns its JSX', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../app.jsx'), 'utf8');
    const appStart = source.indexOf('\nfunction App() {');
    const appEnd = source.indexOf('\n}\n', source.lastIndexOf('\n  return (\n'));
    expect(appStart).toBeGreaterThan(-1);
    const finalReturn = source.lastIndexOf('\n  return (\n', appEnd);
    const afterReturn = source.slice(source.indexOf('\n  );\n', finalReturn), appEnd);
    expect(afterReturn).not.toMatch(/\buse[A-Z]\w*\(/);
  });
});
