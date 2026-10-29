// Authentication helpers for the market Edge Function. jose is injected (npm:jose in Deno, the
// node_modules copy in tests) so these modules have no runtime-specific imports.

export const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/**
 * Verifies a Firebase Auth ID token (the one the app already sends to Supabase) and returns the
 * caller. Throws when the signature, issuer, audience or expiry is wrong.
 */
export async function verifyFirebaseIdToken(token, { projectId, jwtVerify, keySet }) {
  const { payload } = await jwtVerify(token, keySet, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ['RS256'],
  });
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token without subject');
  return { uid: payload.sub, claims: payload };
}

/**
 * OAuth access token for Firestore from a service-account key, cached until shortly before it
 * expires. serviceAccount = parsed JSON key ({ client_email, private_key, token_uri }).
 */
export function createServiceAccountTokenProvider({ serviceAccount, SignJWT, importPKCS8, fetchImpl = fetch }) {
  let cached = null;
  return async function getAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt - 60 > now) return cached.token;

    const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
    const key = await importPKCS8(serviceAccount.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(serviceAccount.client_email)
      .setSubject(serviceAccount.client_email)
      .setAudience(tokenUri)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const response = await fetchImpl(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      throw new Error(`Google token error: ${payload.error_description || payload.error || response.status}`);
    }
    cached = { token: payload.access_token, expiresAt: now + (Number(payload.expires_in) || 3600) };
    return cached.token;
  };
}
