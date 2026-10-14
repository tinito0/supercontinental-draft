// Supabase is used only for PES texture files (Storage). Users authenticate with their
// Firebase ID token (Supabase "Third-Party Auth" → Firebase); there is no Supabase login.
import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const TEXTURE_BUCKET = import.meta.env.VITE_SUPABASE_TEXTURE_BUCKET || 'pes-textures';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: async () => (await auth?.currentUser?.getIdToken(false)) ?? null,
  })
  : null;

/**
 * The `role`/`pes_role` claims are added by scripts/sync-pes-claims.mjs; a token issued
 * before the script ran does not carry them, so refresh once before using Storage.
 */
export async function refreshFirebaseClaims() {
  await auth?.currentUser?.getIdToken(true);
}
