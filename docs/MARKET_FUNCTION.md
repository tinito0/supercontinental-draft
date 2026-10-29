# Función del mercado (Supabase Edge Function `market`)

Los fichajes y la aceptación de traspasos se ejecutan en el servidor, no en el navegador. Así no se pueden
falsificar precios, presupuestos ni el estado del mercado.

```
App ──(token de Firebase + "fichar 7511")──▶ Supabase Edge Function `market`
                                              ├─ verifica el token (claves públicas de Google)
                                              ├─ lee precio real (catalog.json), presupuesto, mercado
                                              └─ escribe en Firestore (API REST, cuenta de servicio)
```

| Pieza | Archivo |
|---|---|
| Entrada (Deno) | `supabase/functions/market/index.ts` |
| Lógica de fichar / aceptar | `supabase/functions/_shared/market.js` |
| Cliente REST de Firestore con transacciones | `supabase/functions/_shared/firestoreRest.js` |
| Token de Firebase y cuenta de servicio | `supabase/functions/_shared/googleAuth.js` |
| Precios (generado) | `supabase/functions/_shared/catalog.json` ← `node scripts/build-market-catalog.mjs` |
| Llamada desde la app | `services/marketService.js` |
| Reglas que lo exigen | `firestore.rules` (sección MERCADO) |
| Tests | `tests/marketFunction.test.js`, `tests/rules/marketFunction.test.js`, `tests/rules/marketRules.test.js` |

Qué hace el servidor y qué sigue en el navegador:

- **Servidor:**
  - fichar (lock, feed, franquicia);
  - liberar (lock, carrito, fichaje del feed, plantilla pública; cierra las ofertas abiertas por el jugador; no
    libera Jugadores Franquicia; no libera con el mercado cerrado);
  - aceptar ofertas (lock, presupuestos, plantillas, carrito del vendedor, oferta, feed; cierra las demás ofertas
    por ese jugador; respeta el estado del mercado). Nombres, escudos y datos del jugador salen de los equipos y
    del catálogo, no de la oferta.
  - migrar una cuenta vieja (email) a la cuenta de Google del mismo manager cuando esa cuenta de Google ya
    existe por separado (`migrateAccount`): perfil, equipo, locks, carrito, ofertas y traspasos en una
    transacción. La cuenta vieja autoriza el pedido y la de Google prueba que es suya con su propio token
    (`screens/LinkGoogleScreen.jsx`, con una instancia secundaria de Firebase).
- **Navegador (validado por reglas):** enviar/rechazar/contraofertar/retirar ofertas por turnos (montos enteros
  positivos), formación, carrito privado. El carrito es una copia: `hooks/useSquadSync.js` lo alinea con los
  locks, y el presupuesto y las exportaciones salen de los locks (`_shared/budget.js`, compartido con la app).
- **Vencimiento de ofertas:** cada turno (oferta, contraoferta, nueva oferta) vence a las 48 h
  (`expiresAtMs`, `_shared/offerExpiry.js`). Una oferta pendiente vencida no retiene plata del comprador y el
  servidor no la acepta; las reglas exigen un vencimiento de unas 48 h en cada turno. Las ofertas anteriores, sin
  `expiresAtMs`, no vencen.
- **Aprobación de equipos:** una cuenta nueva crea su equipo con `approved: false` y no ficha, no oferta ni
  escribe en el chat hasta que el admin la aprueba (Admin → Equipos → Aprobar). Los equipos anteriores no tienen
  el campo y cuentan como aprobados (`_shared/membership.js`, mismas reglas en `firestore.rules`).
- **Mercado cerrado:** la app sigue usable (tácticas, torneo, chat); fichar, ofertar, aceptar y liberar esperan a
  que abra (`MarketClosedBanner`, mismas reglas que el servidor).
- **Hora de apertura programada:** `config/market.openTime` es un instante ISO; los valores viejos sin zona se
  leen como hora argentina (`_shared/marketTime.js`), igual en la app y en el servidor.

## Puesta en marcha (una vez)

El orden importa. Las reglas nuevas impiden fichar desde el navegador, así que **la función tiene que estar
andando antes de publicar las reglas y la app**.

1. **Cuenta de servicio de Firebase.** En Google Cloud Console → IAM → Cuentas de servicio del proyecto
   `supercont-d62df`, creá una cuenta solo para esto, con el rol **Cloud Datastore User**. Generá una clave JSON.
   Si usás la clave del "Firebase Admin SDK" de la consola de Firebase también funciona, pero tiene permisos de
   administrador sobre todo el proyecto. **La clave es secreta: no la subas al repo.**
2. **Secretos en Supabase** (Dashboard → Edge Functions → Secrets, o por CLI):
   ```bash
   npx supabase login
   npx supabase secrets set --project-ref pcmhsucbtonnaikiatuy \
     FIREBASE_SERVICE_ACCOUNT="$(cat ruta/a/la-clave.json)" \
     MARKET_ALLOWED_ORIGINS="https://supercontinental-draft.vercel.app,https://supercont-d62df.web.app,https://supercont-d62df.firebaseapp.com"
   ```
   Agregá a `MARKET_ALLOWED_ORIGINS` tu dominio propio si tenés uno, y `http://localhost:5173` para desarrollo.
3. **Publicar la función** con la verificación de JWT de Supabase apagada. La función verifica el token de
   Firebase por su cuenta:
   ```bash
   npx supabase functions deploy market --no-verify-jwt --project-ref pcmhsucbtonnaikiatuy
   ```
4. **Probar** con la app en local (`npm run dev`, con las variables `VITE_SUPABASE_*` en `.env`) contra la
   base real: fichar un jugador y aceptar una oferta. Si falla, mirá los logs (Dashboard → Edge Functions →
   market → Logs).
5. **Publicar reglas y app juntas:**
   ```bash
   npm run build && firebase deploy
   ```

## Mantenimiento

- **Cambió `public/jugadores.json`:** corré `node scripts/build-market-catalog.mjs` y volvé a publicar la
  función (paso 3). `npm test` falla si el catálogo quedó desactualizado.
- **Proyecto de Supabase en plan gratis:** se pausa tras 7 días sin actividad. Pausado, nadie puede fichar ni
  aceptar traspasos hasta reactivarlo desde el dashboard.
- **Volver atrás:** publicá la versión anterior de `firestore.rules` y de la app (`git checkout <commit> --
  firestore.rules` + build + deploy).

## Probar localmente

```bash
npm test                                   # catálogo, constantes, token
npm run test:rules                         # función + reglas contra el emulador (Java 21)
npx supabase functions serve market --no-verify-jwt --env-file ruta/.env.market   # opcional, necesita Docker
```
