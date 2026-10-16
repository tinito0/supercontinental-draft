# Auditoría integral — Supercontinental Draft (14/10/2026)

Clasificación usada: **CONFIRMADO** (reproducido con prueba o verificado en código y semántica de Firebase),
**POTENCIAL** (riesgo real con condiciones), **RECOMENDACIÓN** (mejora), **NO VERIFICADO** (falta acceso o herramienta).

## 1. Qué se ejecutó

| Verificación | Antes | Después |
|---|---|---|
| `npm test` (Vitest) | 303/307 (4 timeouts por carga de CPU; pasan aislados) | **319/319** |
| `npm run test:rules` (emulador Firestore, Java 21) | 13/13 PES; no había tests del mercado | **37/37** (23 nuevos de mercado) |
| `npm run build` | OK | OK |
| `npm audit --omit=dev` | 6 (4 high, 1 moderate, 1 low) | 5 (ver §4: los high no aplican al navegador) |

No se hizo deploy, ni se tocaron Firebase, Supabase ni GitHub. No se probó la app en un navegador (sin
capturas): los hallazgos de UI salen de lectura de código y CSS.

## 2. Corregido en esta auditoría

### Seguridad del mercado — CRÍTICO, CONFIRMADO con requests falsificados en el emulador
Con el SDK y la config web pública, cualquier manager logueado podía (las 10 cosas probadas en
`tests/rules/marketRules.test.js` contra las reglas anteriores):

- cambiar el presupuesto, la plantilla o el nombre de **cualquier** equipo (`teams/{id}` no chequeaba dueño);
- subirse el presupuesto propio o crearse un equipo con presupuesto arbitrario (se propagaba al perfil en el login);
- ponerse `inWhitelist: true` (saltear el mercado cerrado) o `isAdmin: true` en su perfil (paneles de admin en la UI);
- **robar un jugador** de otro equipo sobrescribiendo su lock;
- modificar o secuestrar ofertas ajenas (la regla miraba el dato nuevo, no el existente);
- publicar fichajes falsos de otros equipos en el feed.

**Bug funcional encontrado en el mismo análisis (CONFIRMADO):** cuando el *vendedor* aceptaba una oferta, la
escritura del lock era rechazada (`PERMISSION_DENIED`). Sólo funcionaban los traspasos aceptados por el comprador
tras una contraoferta.

**Corrección** (`firestore.rules`, `services/transferService.js`):
- `budget`, `inWhitelist`, `isAdmin`, `role` no los escribe el usuario. El presupuesto cambia sólo por el admin
  o por la escritura de un traspaso, que lleva `transferOfferId`: las reglas verifican que esa misma escritura
  acepta la oferta, que acepta quien tiene el turno, que el lock pasa de vendedor a comprador, y acotan el
  movimiento de presupuesto por el monto (base ≤ monto ≤ base × 1,15, comisión 15 %).
- Ofertas por turnos (mismo cuadro en reglas y cliente): `pending` la responde el vendedor (rechazar,
  contraofertar, aceptar) y el comprador puede retirarla; `countered` la responde el comprador (rechazar, aceptar
  o hacer una nueva oferta, que vuelve a `pending`) y el vendedor puede retirar su contraoferta.
- Rechazar/contraofertar/retirar ahora leen la oferta viva dentro de una transacción (antes pisaban un estado
  viejo: se podía "retirar" una oferta ya aceptada y perder su historial).
- El historial acredita la acción al equipo que la hizo (antes un rechazo del comprador figuraba como del vendedor).
- Feed: cada equipo publica sólo sus movimientos y puede borrar los fichajes que libera (antes la limpieza al
  liberar fallaba siempre en silencio para no-admins).

**Además (CONFIRMADO, cerrado por lo anterior):** el comprador podía contraofertar su propia oferta a precio base
y aceptarla él mismo, sin acuerdo del vendedor.

> ⚠️ **Deploy coordinado:** las reglas nuevas exigen `transferOfferId`. Publicá cliente y reglas juntos
> (`npm run build && firebase deploy`); un cliente viejo en caché no podrá aceptar traspasos hasta recargar.

### Otros arreglos
| Problema | Clase | Archivo | Prueba |
|---|---|---|---|
| Posiciones, titulares y dorsales quitados **nunca se borraban** de Firestore (`merge:true` fusiona mapas); posiciones de una formación vieja reaparecían en la nueva y en la exportación PES | CONFIRMADO (emulador) | `components/FormationModal.jsx` → `mergeFields` | prueba de semántica en emulador |
| La app quedaba para siempre en "Conectando al servidor…" si fallaba la carga de la cuenta o del estado del mercado (p. ej. primer ingreso sin red); `appError` se guardaba pero nunca se mostraba | CONFIRMADO (código) | `hooks/useAuth.js`, `app.jsx` (`LoadingScreen` con error + Reintentar) | — |
| Revertir un partido a "programado" dejaba los puntos y goleadores calculados | CONFIRMADO (test RED→GREEN) | `components/tournament/tournamentEngine.js` | `tests/tournamentEngine.test.js` |
| Un ex Jugador Franquicia liberado y refichado normal seguía costando $0 | CONFIRMADO | `hooks/useBudget.js` | `tests/budgetCalculations.test.js` (ahora prueba la función real, antes una copia) |
| "Eliminar fichaje" desde la ficha del jugador abría la confirmación **detrás** del modal (mismo z-index, sin portal); además pedía confirmar dos veces | CONFIRMADO (CSS) | `components/PlayerModal.jsx`, `app.jsx` | — |
| Toda visita descargaba jsPDF (424 kB, 139 kB gzip): el chunk manual `vendor-pdf` capturó el helper de preload de Vite | CONFIRMADO (build) | `vite.config.js` | `dist/index.html` ya no lo precarga |
| `fflate` 0.8.2: bucle infinito con ZIP64 malformado (se usa al descomprimir fuentes compartidas) | CONFIRMADO (advisory) | `package.json` → 0.8.3 | — |
| `react-toastify` instalado sin uso | CONFIRMADO | `package.json` | — |
| Tests PES con archivos reales fallaban por timeout de 5 s bajo carga | CONFIRMADO | `vite.config.js` (`testTimeout` 30 s) | — |

## 3. Pendiente — requiere decisión o trabajo mayor

### Alta
- **Credenciales en el repo (CONFIRMADO, CRÍTICO).** `scripts/credenciales.txt` (emails y contraseñas) está en git
  desde el commit inicial y en GitHub. Cambiá esas contraseñas; sacarlo del historial requiere reescribirlo y
  hacer force-push (decisión tuya).
- **El presupuesto no es 100 % verificable en reglas (riesgo residual, POTENCIAL).** El precio base del jugador
  vive en `jugadores.json`, no en Firestore, así que las reglas sólo acotan el movimiento: quien acepta podría
  desviar como máximo la prima del 15 % de ese traspaso. Tampoco se valida en servidor el saldo libre al fichar
  (sólo en el cliente). La solución completa es una Cloud Function que ejecute fichajes y traspasos.
- **Mercado cerrado sólo en la UI (CONFIRMADO).** Ninguna regla lee `config/market`; con el SDK se puede fichar
  con el mercado cerrado. Se puede agregar a las reglas de locks/ofertas una vez confirmado el id del documento.
- **Catálogo de 59,8 MB** (`public/jugadores.json`, 4,2 MB gzip, 110 campos por jugador) parseado en el hilo
  principal; la página pública `/team/:id` lo baja entero y además lee **todos** los locks para mostrar ~25
  jugadores (CONFIRMADO). Recomendado: generar en `scripts/main.py` sólo los campos usados y un índice liviano.

### Media
- Aceptar una oferta no cancela las demás ofertas pendientes por el mismo jugador: el presupuesto de esos
  compradores queda comprometido hasta que se retiren (CONFIRMADO).
- Service worker (`public/sw.js`): nombres de caché fijos (`*-v1`), cachea todo GET sin límite (fotos, chunks de
  cada deploy), guarda como "foto" el `index.html` que devuelve el rewrite para jugadores sin foto, y precios
  viejos tras actualizar `jugadores.json` (CONFIRMADO / POTENCIAL).
- `vite:preloadError` recarga la página ante cualquier import dinámico fallido, incluso prefetch por hover
  (POTENCIAL: se pierde lo no guardado con red inestable). `vendor-charts` se precarga en todas las páginas.
- La sincronización del roster público reescribe el equipo en cada cambio de cualquier lock de la liga, sin
  esperar a que carguen carrito y locks (CONFIRMADO, amplificación de escrituras).
- Cada tarjeta de oferta abre su listener de chat aunque esté cerrada (necesario hoy para el contador visible).
- Cada guardado del torneo republica todos los resultados como noticias nuevas (`publishedAt` se pisa).
- Más de 12 equipos en la tabla: el 13.º se descarta sin aviso (el tope de 12 es una decisión del proyecto).
- Accesibilidad / sistema de diseño: 7 diálogos hechos a mano sin foco atrapado; 5 escalas distintas de color de
  OVR; contraste insuficiente en toasts (`bg-green-600`/`bg-amber-600` con texto blanco) y en `text-accent` como
  texto chico; `.btn`/`.input` miden 40 px (el sistema pide 44); video del login en loop sin respetar
  `prefers-reduced-motion`; campos sin label asociado (login, chat, editores de torneo); manifest con íconos
  `logo.webp` de 2,6k px declarados como 192/512 y orientación bloqueada.
- Kits PES: "Usar" en el selector de cuellos puede no tener efecto visible con mangas largas si se destilda
  "también cuello de invierno"; `kit.add` acepta secciones con nombre de propiedad de `Object` (`constructor`).

### Baja
- Sin Content-Security-Policy ni HSTS en `firebase.json` (no se encontró ningún sink XSS: no hay
  `dangerouslySetInnerHTML` ni `innerHTML`; React escapa nombres y mensajes).
- Ofertas legibles por cualquier manager (necesario hoy: aceptar suma las ofertas pendientes del comprador).
- Cualquier manager puede borrar documentos de presencia ajenos (lo usa la limpieza de presencia vieja).
- Chat: `senderTeamName`/`gifUrl` no validados (suplantación de nombre; un GIF puede apuntar a cualquier URL).
- `hooks/useRemoteConflict.js` (382 líneas) no lo usa nadie; `public/index.html` es el placeholder de Firebase;
  `public/Capa 1.png` sin uso; `placehold.co` como imagen de respaldo en 14 archivos (pedido externo, falla offline).
- Archivos sueltos: `components/temp.txt`, `components/test.txt`, `components/replace.js`, `scripts/Untitled-1.py`.
- `README.md` desactualizado (no menciona Supabase, el editor PES ni las dependencias actuales).

## 4. Dependencias
- `firebase` / `@grpc/grpc-js` (4 "high"): **no aplican** al bundle del navegador (grpc es del build de Node de
  Firestore); el "fix" que propone npm es bajar a firebase 9. Recomendado: actualizar a la 12.x más reciente en
  un cambio aparte y probado (`npm audit fix` la sube sola: se revirtió para no cambiar el runtime sin prueba).
- `dompurify` (low, transitiva de jsPDF): el modo afectado (`IN_PLACE`) no lo usa la app.

## 5. No verificado
- Configuración de la consola de Firebase (alta abierta de usuarios, dominios autorizados, quién tiene el claim
  `admin`) y las políticas reales del proyecto de Supabase.
- Comportamiento visual en dispositivos (no hubo capturas) y compatibilidad en el juego del editor PES.
