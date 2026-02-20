import { SignJWT, jwtVerify } from 'jose';
const encoder = new TextEncoder();
export async function createSessionToken(payload, secret) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(payload.exp)
        .sign(encoder.encode(secret));
}
export async function verifySessionToken(token, secret) {
    try {
        const { payload } = await jwtVerify(token, encoder.encode(secret));
        return payload;
    }
    catch {
        return null;
    }
}
// =====================
// PASSWORD
// =====================
export async function hashPassword(password) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Buffer.from(hash).toString('hex');
}
export async function verifyPassword(password, hash) {
    return (await hashPassword(password)) === hash;
}
