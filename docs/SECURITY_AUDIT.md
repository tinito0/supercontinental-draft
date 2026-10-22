# Auditoría de seguridad antes de abrir la web al público

Fase 1 del brief «Public Community Platform & Security Audit»: revisión del código y de los datos públicos en producción
(solo lectura). Empezó el 2026-10-21 y se cerró el 2026-10-22. Que los tests pasen no prueba que la app sea segura:
esta lista cubre lo revisado, no todo lo posible.

## Alcance

- `firestore.rules`, completas, con tests de reglas en el emulador (`npm run test:rules`).
- Firebase Storage.
- Auth y roles: `hooks/useAuth.js`, `isAdmin()`.
- Edge Functions `market` y `match-feed` y sus módulos en `supabase/functions/_shared`.
- Políticas de Supabase Storage (`supabase/storage-policies.sql`).
- Encabezados del hosting.
- Secretos en el repo.
- Dependencias de producción (`npm audit --omit=dev`).
- Sumideros XSS (`dangerouslySetInnerHTML`, `innerHTML`).
- Datos públicos reales: los docs `teams`, `config` y `presence` se leyeron con la clave web pública, como podría hacerlo
  cualquiera. Solo se miraron nombres de campos, no valores.

## Hallazgos

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| S1 | **Alta** | Cualquier cuenta de Google que entra a `/draft` recibe un equipo «pendiente» (`useAuth`). Las reglas daban lectura con solo tener sesión, así que un desconocido podía leer **todas las ofertas, las negociaciones y el chat de managers**. | **Corregido y desplegado.** Ofertas: solo los dos clubes. Mensajes: solo los dos clubes de la oferta. Chat de managers: solo managers aprobados. Siempre, además, el admin. Tests en `tests/rules/marketRules.test.js`. |
| S2 | Media | `presence/{uid}`: cualquier cuenta con sesión podía borrar la presencia de otro manager. | **Corregido y desplegado**: solo la propia o el admin. Lleva test. |
| S3 | Media | **Firebase Storage** (escudos subidos desde Admin → Equipos): no hay `storage.rules` en el repo, así que las reglas viven solo en la consola y no se pudieron verificar. | **Pendiente: revisar en la consola.** Lo esperado es lectura pública y escritura solo del admin en `team_logos/`. |
| S4 | Media | No hay Content-Security-Policy ni Permissions-Policy en el hosting. Sí están `nosniff`, `X-Frame-Options` y `Referrer-Policy`. | **Hecho, sin desplegar (2026-10-22).** `Content-Security-Policy-Report-Only` y `Permissions-Policy` en `firebase.json`. Los scripts inline de `index.html` pasaron a `public/boot.js`, así que la política no necesita `'unsafe-inline'` en scripts. Siguiente paso: revisar la consola del navegador en producción (login con Google, mercado, GIFs, `/en-vivo`, OBS) y, sin violaciones, pasarla a `Content-Security-Policy`. |
| S5 | Baja | `npm audit`: 4 altas y 1 baja. `@grpc/grpc-js` viene por `firebase` y solo se usa en Node, no en el navegador. `dompurify` <3.4.16 viene por `jspdf`; las advertencias son del modo `IN_PLACE`, que la app no usa. | Pendiente: `npm audit fix` para dompurify (sin cambios incompatibles). Firebase, cuando salga una versión corregida. |
| S6 | Baja | `market` responde CORS `*` si falta `MARKET_ALLOWED_ORIGINS`. La función exige el token de Firebase, así que no hay CSRF, pero conviene limitarlo. | Pendiente: fijar el secret con el dominio de producción. |
| S7 | Baja | `shared_formations` y `suggestions` aceptan creaciones de cualquier cuenta con sesión. Las sugerencias tienen límite de largo; las formaciones no. | **Hecho en las reglas, sin desplegar (2026-10-22).** Campos permitidos, textos con largo máximo, 11 titulares y 60 suplentes como máximo. Tests en `tests/rules/marketRules.test.js`. |
| S8 | Info | La interfaz de admin también mira `profile.isAdmin`/`role`, pero las reglas y el servidor usan el UID fijo o el claim `admin`. Un usuario que se marque admin en el navegador ve los paneles, pero cualquier escritura le falla. | Aceptado. |

## Revisado y sin problema

- **Emails expuestos:** los 12 docs públicos de `teams` no tienen campo `email`. El hallazgo pendiente de la primera
  pasada queda cerrado.
- **Escrituras sensibles:** locks, presupuesto, whitelist, aprobación, feed de traspasos, ofertas aceptadas,
  torneo, overlay, `live_matches`, contenidos de la web y configuración son solo del admin o del servidor. Hay tests
  de reglas para cada caso.
- **`match-feed`:**
  - token Bearer de 32 caracteres o más, comparado en tiempo constante;
  - valida el partido (clave, equipos, marcador, tamaño de 256 KB como máximo);
  - el token vive solo en el secret y en `%APPDATA%` de la PC del juego.
- **`market`:** verifica el token de Firebase; los precios salen de `catalog.json` en el servidor.
- **Secretos en el repo:** no hay claves privadas ni cuentas de servicio. `.env` y `vendor/` están en `.gitignore`. La
  config web de Firebase y la clave publicable de Supabase son públicas por diseño.
- **XSS:** no hay `dangerouslySetInnerHTML` ni `innerHTML` en el código de la app. El QR del overlay se dibuja como
  SVG desde datos validados (solo `https://`).
- **Supabase Storage:** políticas restrictivas por rol (`supabase/storage-policies.sql`).
- **`config` público:** solo tiene `market.{status, openTime}`.

## Qué falta antes de abrir votaciones y predicciones al público

1. ~~Desplegar las reglas (S1, S2).~~ Hecho.
2. Revisar las reglas de Firebase Storage en la consola (S3).
3. Votos y predicciones sin cuenta (lo eligió el usuario):
   - pasan por una Edge Function nueva, nunca por escrituras directas del navegador;
   - la función controla la ventana de votación con el estado en vivo del partido (`live_matches`), un voto por
     navegador y partido, y un tope por IP (guardada solo como hash con sal secreta);
   - los totales se guardan en Firestore, escritos solo por la función.

   Así no se usa el login anónimo de Firebase: con él, cada votante tendría sesión y heredaría los permisos de
   «cuenta con sesión».

   Riesgo aceptado: sin cuenta, una persona puede votar más de una vez con otro navegador o dispositivo. El tope por IP
   lo limita, pero no lo evita.
4. S4 a S7 se pueden hacer en paralelo; no bloquean.
