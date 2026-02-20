import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs'

const encoder = new TextEncoder();

export async function createSessionToken(payload: any, secret: string) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(payload.exp)
        .sign(encoder.encode(secret));
}

export async function verifySessionToken(token: string, secret: string) {
    try {
        const { payload } = await jwtVerify(token, encoder.encode(secret));
        return payload;
    } catch {
        return null;
    }
}

// =====================
// PASSWORD
// =====================
export async function hashPassword(password: string) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
}