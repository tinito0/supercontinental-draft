#!/usr/bin/env node
// Syncs Firebase custom claims with the PES roles stored in Firestore, so Supabase Storage
// (Third-Party Auth → Firebase) can authorize texture uploads:
//   role: 'authenticated'   required by Supabase for any Firebase token
//   pes_role: <role>        checked by supabase/storage-policies.sql
// Only users with a PES role get the claims; everyone else is left without them (Supabase
// treats them as anonymous). Existing claims such as `admin` are preserved.
//
// Runs locally with a service account (no Cloud Functions needed on the Spark plan):
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
//   node scripts/sync-pes-claims.mjs            (dry run: shows what would change)
//   node scripts/sync-pes-claims.mjs --apply    (writes the claims)
// Run it again after changing roles in the app. Users must sign in again (or wait up to an
// hour for their token to refresh) before the new claims reach Supabase.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APP_ID = 'scl-draft-2025'; // utils/constants.js APP_ID
const HARDCODED_ADMIN_UID = '2Qn5j9a9ABW66iPyFL6ZfqwXBqG3'; // firestore.rules isAdmin()
const APPLY = process.argv.includes('--apply');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio de Firebase).');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

const roles = new Map();
const snap = await db.collection(`artifacts/${APP_ID}/pes_roles`).get();
for (const d of snap.docs) roles.set(d.id, d.data().role);

const changes = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    const claims = { ...(user.customClaims || {}) };
    const isAppAdmin = user.uid === HARDCODED_ADMIN_UID || claims.admin === true;
    const pesRole = isAppAdmin ? 'super_admin' : roles.get(user.uid) || null;
    const next = { ...claims };
    if (pesRole) {
      next.role = 'authenticated';
      next.pes_role = pesRole;
    } else {
      delete next.pes_role;
      if (next.role === 'authenticated') delete next.role;
    }
    if (JSON.stringify(next) !== JSON.stringify(claims)) {
      changes.push({ uid: user.uid, email: user.email || '', from: claims.pes_role || '-', to: next.pes_role || '-', next });
    }
  }
  pageToken = page.pageToken;
} while (pageToken);

for (const c of changes) console.log(`${APPLY ? 'APLICADO ' : 'pendiente'}  ${c.uid}  ${c.email}  pes_role: ${c.from} -> ${c.to}`);
if (APPLY) for (const c of changes) await auth.setCustomUserClaims(c.uid, c.next);
console.log(`${changes.length} usuario(s) ${APPLY ? 'actualizados' : 'cambiarían (usá --apply para escribir)'}.`);
