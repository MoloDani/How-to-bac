import { verifyAccess } from './tokens.js';
/** Rejects the request unless a valid access token is present. */
export async function requireAuth(req, reply) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'missing_token' });
    }
    try {
        req.userId = BigInt(verifyAccess(header.slice(7).trim()).sub);
    }
    catch (err) {
        // Separate code for expiry so the client knows to silently refresh
        // instead of bouncing the user to the login screen.
        return reply.code(401).send({
            error: err?.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token',
        });
    }
}
/** Same check but never rejects — for routes that vary by signed-in state. */
export async function optionalAuth(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return;
    try {
        req.userId = BigInt(verifyAccess(header.slice(7).trim()).sub);
    }
    catch {
        /* treat as anonymous */
    }
}
/** Narrowing helper — req.userId is bigint|undefined in the type system. */
export function currentUserId(req) {
    if (req.userId === undefined) {
        throw new Error('currentUserId called on an unauthenticated route');
    }
    return req.userId;
}
