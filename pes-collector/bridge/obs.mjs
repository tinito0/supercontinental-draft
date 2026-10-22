#!/usr/bin/env node
// Control del overlay de OBS desde la PC del streaming, para los botones de Macro Deck (acción «Run command» o
// «Start application» de Windows Utils con scl-obs.cmd). Llama a la Edge Function `overlay-control` con el token del
// bridge (%APPDATA%/scl-bridge/config.json); el token nunca se imprime. docs/MATCH_FEED.md, sección Macro Deck.
//
//   scl-obs scene <live|previa|descanso|final|tabla|bracket|repechaje|goleadores>
//   scl-obs popup <vota|liga|tabla|equipos|off> [segundos] [right|left|center]
//   scl-obs card <mvp|prediction|cup|off> [segundos]
//   scl-obs toggle <marcador|lower|ticker|auto> <on|off>
//
// Sale con 0 si el overlay cambió y con 1 si no (el motivo queda en _bridge/obs.log y en la consola).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseObsArgs } from './obsCommand.js';

const TIMEOUT_MS = 8000;

function loadConfig() {
  const file = join(process.env.APPDATA || '.', 'scl-bridge', 'config.json');
  if (!existsSync(file)) throw new Error(`Falta ${file}: corré pes-collector/bridge/setup.mjs (docs/MATCH_FEED.md).`);
  const config = JSON.parse(readFileSync(file, 'utf8'));
  const endpoint = config.overlayEndpoint || String(config.endpoint || '').replace(/\/match-feed$/, '/overlay-control');
  if (!endpoint.startsWith('https://') || !config.token) throw new Error('config.json no tiene endpoint y token.');
  return { endpoint, token: config.token, logDir: join(config.probeDir || 'E:/eFootball PES 2021/scl_probe', '_bridge') };
}

function log(logDir, message) {
  const line = `[${new Date().toLocaleString()}] ${message}`;
  process.stdout.write(`${line}\n`);
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(join(logDir, 'obs.log'), `${line}\n`);
  } catch {
    // La consola alcanza si no se puede escribir el log.
  }
}

async function main() {
  const command = parseObsArgs(process.argv.slice(2));
  const { endpoint, token, logDir } = loadConfig();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    const hint = response.status === 404 ? ' (¿la función overlay-control está desplegada?)' : '';
    log(logDir, `obs: error ${response.status}: ${body.error || 'sin respuesta'}${hint}`);
    process.exit(1);
  }
  log(logDir, `obs: ${body.summary}`);
}

main().catch(error => {
  process.stderr.write(`obs: ${error.message}\n`);
  process.exit(1);
});
