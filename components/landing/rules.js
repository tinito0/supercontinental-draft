import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../../utils/constants.js';

/* The league's draft rules, shown on the draft landing and on the league site's Reglamento page.
   Each rule matches what the market Edge Function enforces (supabase/functions/_shared/market.js). */
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
      { title: 'Centro de traspasos', desc: 'Proponé intercambios, ofertas de dinero o contraofertas directas a otros managers.' },
      { title: 'Jugador franquicia', desc: `Un fichaje gratis por manager: un jugador de ${FRANCHISE_MIN_AGE} años o más con OVR entre ${FRANCHISE_MIN_OVR} y ${FRANCHISE_MAX_OVR}.` },
      { title: 'Alineaciones obligatorias', desc: 'Antes de cada fecha, todo equipo tiene que tener guardados su 11, los suplentes y la estrategia S1.' },
    ],
  },
];
