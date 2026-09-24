# Prompt para Antigravity — 3 fixes de presupuesto (supercontinental-draft)

## Contexto
Repo: `tinito0/supercontinental-draft`. Se detectaron 2 bugs de integridad de presupuesto y 1 recalibración de datos, encontrados diagnosticando un sobregasto real (SV Falke Düsseldorf: $485.18M gastado vs $472.17M asignado).

---

## FIX 1 — Traspasos no descuentan ofertas comprometidas del presupuesto

**Problema:** `remainingBudget` (app.jsx, useMemo ~línea 1215) se calcula como `userProfile.budget - totalCartCost`, sin restar plata comprometida en ofertas de traspaso enviadas (`sentOffers`). Ese descuento (`committedInOffers`) existe pero SOLO se usa para mostrar `liquidBudget` en un panel informativo de `CartModal.jsx` (~línea 703-706) — nunca se aplica en el chequeo real de compra (`app.jsx` ~línea 1622: `if (!isFranchise && remainingBudget < playerCost)`).

**Consecuencia:** un manager manda una oferta de traspaso por $X, y mientras esa oferta sigue pendiente, puede fichar en el mercado directo hasta agotar su `remainingBudget` completo (sin descontar $X). Si el vendedor acepta la oferta después, el total comprometido supera el presupuesto real.

**Fix requerido:**
1. En `app.jsx`, el cálculo de `remainingBudget` (línea ~1215-1217) debe restar también la plata comprometida en `sentOffers` pendientes (mismo cálculo que ya existe como `committedInOffers` en `CartModal.jsx` línea 703) — unificar en un solo lugar (helper o el propio `remainingBudget`) para que TODO chequeo de compra (fast-buy y aceptación de oferta) use el mismo número líquido.
2. Server-side: `firestore.rules` no tiene ninguna validación de `budget` actualmente. Agregar regla que, en la transacción de fichaje (fast-buy) y en la de aceptación de oferta de traspaso, verifique que `budget_actual - precio_jugador >= 0` antes de permitir el write. Sin esto, el chequeo del cliente es bypasseable.
3. Mismo criterio para la aceptación de una oferta de traspaso entrante (buscar el flujo de "aceptar oferta" — probablemente en `ProposalChat.jsx` o `app.jsx`, cerca de la lógica de `TransferProposalModal.jsx`): debe volver a validar presupuesto del comprador en el momento de aceptar, no solo al crear la oferta.

---

## FIX 2 — Límite de 1 Jugador Franquicia no se aplica

**Problema:** `app.jsx` línea 1661 setea `franchisePlayerUsed: true` en el perfil del manager al fichar un jugador franquicia, pero ese flag nunca se lee en ningún chequeo posterior. `handleAddToCart` (línea ~1610) no bloquea un segundo fichaje con `isFranchise=true`.

**Criterio actualizado (confirmado por Santino):** edad ≥ 30, OVR entre 82 y 89 (antes: 31+, 83-89). Ya está en `app.jsx` línea 1067-1068 (`isFranchiseEligible`) — actualizar esos dos números si no están ya en 30/82.

**Fix requerido:**
1. Cliente: en `handleAddToCart`, si `isFranchise === true`, bloquear con mensaje de error si `userProfile.franchisePlayerUsed === true`.
2. Server-side: `firestore.rules` debe validar lo mismo en la transacción de fichaje franquicia — que el perfil del manager no tenga ya `franchisePlayerUsed: true`, y que el jugador cumpla edad≥30 y OVR 82-89. Sin esto, un cliente modificado puede fichar franquicias ilimitadas.

---

---

## Verificación pedida
Después de aplicar los 3 fixes, confirmar:
- Un intento de fast-buy que exceda presupuesto líquido (incluyendo ofertas comprometidas) es rechazado por `firestore.rules`, no solo por el cliente.
- Un segundo intento de fichaje franquicia es bloqueado, cliente y servidor.
- Los 12 equipos tienen el `budget` de la tabla de arriba.
