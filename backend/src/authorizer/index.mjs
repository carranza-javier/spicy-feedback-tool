// Lambda Authorizer — REQUEST type, HTTP API payload format v2.0, simple responses.
//
// API Gateway calls this before any admin route handler.
// We return { isAuthorized: true/false } — the "simple response" format
// enabled by enable_simple_responses = true in Terraform.
// API Gateway v2 lowercases all header names before passing them to us.

import { verifyToken } from '../lib/jwtUtils.mjs';

export const handler = async (event) => {
  try {
    const authHeader = event.headers?.authorization ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      return { isAuthorized: false };
    }

    const token = authHeader.slice(7).trim();
    verifyToken(token); // throws if expired, malformed, or signature invalid

    return { isAuthorized: true };
  } catch {
    // Any verification failure → deny. Never surface the error detail to callers.
    return { isAuthorized: false };
  }
};
