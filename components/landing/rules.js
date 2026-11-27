import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR, MAX_TRANSFER_MULTIPLIER } from '../../utils/constants.js';
import { DEFAULT_BENCH_MIN_AVG_OVR, SQUAD_MIN_PLAYERS, LOCAL_MIN_PLAYERS, SQUAD_RULE_LABELS } from '../../utils/squadRules.js';

/* The league's draft rules, shown on the draft landing and on the league site's Reglamento page.
   Market rules match what the market Edge Function enforces (supabase/functions/_shared/market.js); squad rules
   are the ones in utils/squadRules.js (the board blocks the bench one, Mi Equipo and Administración show all three).
   The bench minimum is admin-editable, so the groups are built from it. */
export const buildRuleGroups = (benchMin = DEFAULT_BENCH_MIN_AVG_OVR) => [
  {
    title: 'Mercado',
    rules: [
      { title: 'Presupuesto asignado', desc: 'Cada mánager arranca con el presupuesto que fija la administración. Ningún fichaje ni oferta puede dejarlo en negativo.' },
      { title: 'Bloqueo inmediato', desc: 'Cuando fichás a un jugador, queda bloqueado al instante para el resto de los mánagers.' },
      { title: 'Ventas al 100%', desc: 'Podés liberar a un jugador cuando quieras y recuperás todo lo que pagaste para volver a invertir.' },
    ],
  },
  {
    title: 'Plantel',
    rules: [
      { title: 'Centro de traspasos', desc: `Proponé intercambios, ofertas de dinero o contraofertas directas a otros mánagers, por hasta el ${Math.round(MAX_TRANSFER_MULTIPLIER * 100)}% del valor del jugador.` },
      { title: 'Jugador franquicia', desc: `Un fichaje gratis por mánager: un jugador de ${FRANCHISE_MIN_AGE} años o más con media entre ${FRANCHISE_MIN_OVR} y ${FRANCHISE_MAX_OVR}.` },
      { title: 'Alineaciones obligatorias', desc: 'Antes de cada fecha, todo equipo tiene que tener guardados su 11, los suplentes y la estrategia S1.' },
    ],
  },
  {
    title: 'Reglas del plantel',
    rules: [
      { title: SQUAD_RULE_LABELS.squad.long, desc: `Cada club arma un plantel de al menos ${SQUAD_MIN_PLAYERS} jugadores.` },
      { title: SQUAD_RULE_LABELS.bench.long, desc: `Tus suplentes, los que no están en el once, tienen que promediar ${benchMin} o más. Con ${SQUAD_MIN_PLAYERS} jugadores o más, la táctica no guarda un once que deje el banco por debajo.` },
      { title: SQUAD_RULE_LABELS.locals.long, desc: `Al menos ${LOCAL_MIN_PLAYERS} jugadores nacidos en el país del club o con su nacionalidad.` },
    ],
  },
];

/** The groups with the reglamento's default bench minimum (the live value comes from useSquadRulesConfig). */
export const RULE_GROUPS = buildRuleGroups();
