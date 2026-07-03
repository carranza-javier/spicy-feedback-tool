// JWT sign and verify using Node's native crypto module (no external library).
//
// A JWT has three parts joined by dots:  header.payload.signature
//
// Each part is Base64URL-encoded:
//   Base64URL = standard Base64, but  +→-  /→_  and no = padding.
//   This keeps the token URL-safe and compact.
//
// We implement HS256: HMAC-SHA-256 with a shared secret.

import { createHmac, timingSafeEqual } from 'node:crypto';

// ── Base64URL helpers ──────────────────────────────────────────────────────────

// Encode any Buffer or string to Base64URL.
const b64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

// Decode a Base64URL string back to a Buffer.
const b64urlDecode = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ── Constants ─────────────────────────────────────────────────────────────────

// The JWT header is the same for every HS256 token, so we encode it once.
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// ── signToken ─────────────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given payload object.
 *
 * Step-by-step:
 *  1. Take the fixed HS256 header (already Base64URL-encoded as HEADER above).
 *  2. Merge caller-supplied claims with iat (issued-at) and exp (expires-at),
 *     then Base64URL-encode the resulting JSON as the payload segment.
 *  3. The "signing input" is the string  "header.payload"  — exactly the first
 *     two dot-separated parts of the final token.
 *  4. Feed the signing input into HMAC-SHA256 keyed with JWT_SECRET.
 *     The digest is 32 raw bytes.
 *  5. Base64URL-encode those 32 bytes → the signature segment.
 *  6. Return  "header.payload.signature".
 *
 * JWT_SECRET must be set as an environment variable (injected by Terraform from
 * SSM Parameter Store — never hardcoded).
 */
export function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');

  const now = Math.floor(Date.now() / 1000); // Unix time in seconds
  const claims = { ...payload, iat: now, exp: now + SEVEN_DAYS_SECONDS };

  const encodedPayload = b64url(JSON.stringify(claims));
  const signingInput = `${HEADER}.${encodedPayload}`;

  // HMAC-SHA256: keyed hash — only someone who knows the secret can produce
  // a valid signature, so forging or tampering invalidates it.
  const sigBytes = createHmac('sha256', secret).update(signingInput).digest();

  return `${signingInput}.${b64url(sigBytes)}`;
}

// ── verifyToken ───────────────────────────────────────────────────────────────

/**
 * Verify a JWT and return its decoded payload.
 *
 * Step-by-step:
 *  1. Split the token on '.' → [encodedHeader, encodedPayload, encodedSig].
 *     Any token that doesn't have exactly three parts is malformed.
 *  2. Recompute HMAC-SHA256 over  "encodedHeader.encodedPayload"  using
 *     JWT_SECRET — the same operation that signToken performed.
 *  3. Compare the recomputed signature to the one in the token using
 *     timingSafeEqual.  This is a constant-time comparison: it takes the same
 *     amount of time regardless of where the bytes first differ.  Without this,
 *     an attacker could measure tiny timing differences and learn the secret
 *     one byte at a time (a "timing oracle" attack).
 *     Note: timingSafeEqual requires both buffers to have the same length;
 *     if they don't, the token is immediately invalid without needing to compare.
 *  4. Base64URL-decode the payload and JSON-parse it.
 *  5. Check that the current time is before exp.  If not, the token has expired.
 *  6. Return the payload object.  Throws on any failure.
 */
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT: expected three dot-separated parts');

  const [encodedHeader, encodedPayload, encodedSig] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Recompute what the signature *should* be.
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  const provided = b64urlDecode(encodedSig);

  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('JWT signature is invalid');
  }

  const payload = JSON.parse(b64urlDecode(encodedPayload).toString('utf8'));

  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('JWT has expired');
  }

  return payload;
}
