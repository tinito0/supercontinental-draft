import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR, MAX_TRANSFER_MULTIPLIER } from '../../utils/constants.js';
import { BENCH_MIN_AVG_OVR, SQUAD_MIN_PLAYERS, LOCAL_MIN_PLAYERS } from '../../utils/squadRules.js';

/* The league's draft rules, shown on the draft landing and on the league site's Reglamento page.
   Market rules match what the market Edge Function enforces (supabase/functions/_shared/market.js); squad rules
   are the ones in utils/squadRules.js (the board blocks the bench one, Mi Equipo and Administración show all three). */
export const RULE_GROUPS = [
  {
    title: 'Mercado',
    rules: [
      { title: 'Presupuesto asignado', desc: 'Cada manager arranca con el presupuesto que fija la administración. Ningún fichaje ni oferta puede dejarlo en negativo.' },
      { title: 'Bloqueo inmediato', desc: 'Cuando fichás a un jugador, queda bloqueado al instante para el resto de los managers.' },
      { title: 'Ventas al 100%', desc: 'Podés liberar a un jugador cuando quieras y recuperás todo lo que pagaste para volver a invertir.' },
    ],
  },
  {
    title: 'Plantel',
    rules: [
      { title: 'Centro de traspasos', desc: `Proponé intercambios, ofertas de dinero o contraofertas directas a otros managers, por hasta el ${Math.round(MAX_TRANSFER_MULTIPLIER * 100)}% del valor del jugador.` },
      { title: 'Jugador franquicia', desc: `Un fichaje gratis por manager: un jugador de ${FRANCHISE_MIN_AGE} años o más con OVR entre ${FRANCHISE_MIN_OVR} y ${FRANCHISE_MAX_OVR}.` },
      { title: 'Alineaciones obligatorias', desc: 'Antes de cada fecha, todo equipo tiene que tener guardados su 11, los suplentes y la estrategia S1.' },
    ],
  },
  {
    title: 'Reglas del plantel',
    rules: [
      { title: 'Plantel mínimo', desc: `Cada club arma un plantel de al menos ${SQUAD_MIN_PLAYERS} jugadores.` },
      { title: 'Banco con nivel', desc: `Los jugadores que no están en tu 11 tienen que promediar ${BENCH_MIN_AVG_OVR} o más. Con ${SQUAD_MIN_PLAYERS} jugadores o más, la pizarra no guarda un once que deje el banco por debajo.` },
      { title: 'Jugadores locales', desc: `Al menos ${LOCAL_MIN_PLAYERS} jugadores nacidos en el país del club o con su nacionalidad.` },
    ],
  },
];
