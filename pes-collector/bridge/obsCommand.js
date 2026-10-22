// Argumentos de scl-obs (obs.mjs) → comando de la función overlay-control
// (supabase/functions/_shared/overlayControl.js, que es quien valida de verdad). Puro; tests/pesCollector/obsCommand.test.js.

export const OBS_USAGE = [
  'scl-obs scene <live|previa|descanso|final|tabla|bracket|repechaje|goleadores>',
  'scl-obs popup <vota|liga|tabla|equipos|off> [segundos] [right|left|center]',
  'scl-obs card <mvp|prediction|cup|off> [segundos]',
  'scl-obs toggle <marcador|lower|ticker|auto> <on|off>',
].join('\n');

export function parseObsArgs(argv) {
  const [action, first, second, third] = argv.map(arg => String(arg).trim().toLowerCase());
  const usage = () => { throw new Error(`Uso:\n${OBS_USAGE}`); };
  if (!first) usage();
  switch (action) {
    case 'scene':
      return { action, scene: first };
    case 'popup': {
      const command = { action, preset: first };
      if (second !== undefined) {
        if (!/^\d+$/.test(second)) usage();
        command.seconds = Number(second);
      }
      if (third !== undefined) command.position = third;
      return command;
    }
    case 'card': {
      const command = { action, kind: first };
      if (second !== undefined) {
        if (!/^\d+$/.test(second)) usage();
        command.seconds = Number(second);
      }
      return command;
    }
    case 'toggle':
      if (second !== 'on' && second !== 'off') usage();
      return { action, target: first, value: second };
    default:
      return usage();
  }
}
