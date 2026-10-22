#!/usr/bin/env node
// One-time setup of the bridge's upload: writes %APPDATA%/scl-bridge/config.json and, with --set-secret, stores the
// same token as the MATCH_FEED_TOKEN secret of the match-feed function. The token is never printed.
//
//   node pes-collector/bridge/setup.mjs [--project-ref REF] [--probe-dir DIR] [--set-secret] [--new-token]
//
//   --project-ref  Supabase project (default pcmhsucbtonnaikiatuy, the one in docs/MARKET_FUNCTION.md)
//   --set-secret   runs `npx supabase secrets set` (needs `npx supabase login` first)
//   --new-token    replaces an existing token (the old one stops working once the secret is updated)
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const value = flag => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const projectRef = value('--project-ref') || 'pcmhsucbtonnaikiatuy';
const configDir = join(process.env.APPDATA || '.', 'scl-bridge');
const configFile = join(configDir, 'config.json');
const current = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};

const token = current.token && !argv.includes('--new-token') ? current.token : randomBytes(36).toString('base64url');
const config = {
  ...current,
  endpoint: `https://${projectRef}.supabase.co/functions/v1/match-feed`,
  token,
  probeDir: value('--probe-dir') || current.probeDir || 'E:/eFootball PES 2021/scl_probe',
};
mkdirSync(configDir, { recursive: true });
writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`config escrita: ${configFile} (endpoint ${config.endpoint}, token de ${token.length} caracteres)\n`);

if (argv.includes('--set-secret')) {
  // An env file instead of a command-line argument, so the token does not show up in the process list.
  const envFile = join(tmpdir(), `scl-match-feed-${process.pid}.env`);
  writeFileSync(envFile, `MATCH_FEED_TOKEN=${token}\n`, { mode: 0o600 });
  try {
    const result = spawnSync('npx', ['--yes', 'supabase', 'secrets', 'set', '--env-file', envFile, '--project-ref', projectRef], {
      stdio: 'inherit', shell: process.platform === 'win32',
    });
    if (result.status !== 0) process.exitCode = result.status || 1;
    else process.stdout.write('secret MATCH_FEED_TOKEN guardado en Supabase\n');
  } finally {
    rmSync(envFile, { force: true });
  }
}
