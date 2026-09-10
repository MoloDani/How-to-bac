// src/auth/tokens.ts
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { env } from '../env.js';
const ACCESS_TTL = '15m';
const REFRESH_DAYS = 60;
const VERIFY_HOURS = 24;
const RESET_HOURS = 1;
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// ---------- access tokens (stateless JWT) ----------
export function signAccess(userId) {
    return jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
        expiresIn: ACCESS_TTL,
        issuer: 'bacapi',
    });
}
export function verifyAccess(token) {
    return jwt.verify(token, env.JWT_SECRET, { issuer: 'bacapi' });
}
// ---------- refresh tokens (opaque, rotating) ----------
export async function issueRefresh(userId, familyId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.refresh_tokens.create({
        data: {
            user_id: userId,
            token_hash: sha256(token),
            family_id: familyId ?? crypto.randomUUID(),
            expires_at: new Date(Date.now() + REFRESH_DAYS * 86_400_000),
        },
    });
    return token;
}
/**
 * Exchange a refresh token for a new pair.
 * A token presented twice means someone has a copy they shouldn't, so the
 * whole family is revoked — attacker and legitimate user both get logged out.
 */
export async function rotateRefresh(token) {
    const row = await prisma.refresh_tokens.findUnique({
        where: { token_hash: sha256(token) },
    });
    if (!row)
        return null;
    if (row.revoked_at !== null) {
        await revokeFamily(row.family_id);
        return null;
    }
    if (row.expires_at < new Date())
        return null;
    await prisma.refresh_tokens.update({
        where: { id: row.id },
        data: { revoked_at: new Date() },
    });
    return {
        userId: row.user_id,
        access: signAccess(row.user_id),
        refresh: await issueRefresh(row.user_id, row.family_id),
    };
}
export async function revokeFamily(familyId) {
    await prisma.refresh_tokens.updateMany({
        where: { family_id: familyId, revoked_at: null },
        data: { revoked_at: new Date() },
    });
}
export async function revokeByToken(token) {
    const row = await prisma.refresh_tokens.findUnique({
        where: { token_hash: sha256(token) },
        select: { family_id: true },
    });
    if (row)
        await revokeFamily(row.family_id);
}
/** Log the user out everywhere. Called after a password reset. */
export async function revokeAllForUser(userId) {
    await prisma.refresh_tokens.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
    });
}
// ---------- single-use tokens (verify / reset) ----------
/**
 * Issues a raw token (emailed to the user) and stores only its hash.
 * Any previous unused token for the same purpose is burned, so an old link
 * sitting in the inbox stops working once a new one is sent.
 */
export async function issueAuthToken(userId, purpose) {
    const raw = crypto.randomBytes(32).toString('base64url');
    const hours = purpose === 'password_reset' ? RESET_HOURS : VERIFY_HOURS;
    await prisma.$transaction([
        prisma.auth_tokens.updateMany({
            where: { user_id: userId, purpose, used_at: null },
            data: { used_at: new Date() },
        }),
        prisma.auth_tokens.create({
            data: {
                user_id: userId,
                purpose,
                token_hash: sha256(raw),
                expires_at: new Date(Date.now() + hours * 3_600_000),
            },
        }),
    ]);
    return raw;
}
/** Validates and burns a single-use token. Returns the user id or null. */
export async function consumeAuthToken(raw, purpose) {
    const row = await prisma.auth_tokens.findUnique({
        where: { token_hash: sha256(raw) },
    });
    if (!row)
        return null;
    if (row.purpose !== purpose)
        return null;
    if (row.used_at !== null)
        return null;
    if (row.expires_at < new Date())
        return null;
    // Conditional update: if two requests race, only one flips used_at.
    const burned = await prisma.auth_tokens.updateMany({
        where: { id: row.id, used_at: null },
        data: { used_at: new Date() },
    });
    if (burned.count === 0)
        return null;
    return row.user_id;
}
