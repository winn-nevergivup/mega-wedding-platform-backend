import { eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbClient, invitations, guests, wishlistGifts, wishlistClaims } from '../db';
import { cacheHelper } from '../db/utils/cacheHelpers'; // helper cache bersih
const invite = new Hono();
/**
 * GET /:slug
 * Ambil invitation + guest info (read-only)
 * Query: ?guest=guestId
 */
invite.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const guestId = c.req.query('guest');
    if (!guestId)
        return c.json({ error: 'Guest ID required' }, 400);
    const cacheKey = cacheHelper.getInvitationKey(slug, guestId);
    // 1️⃣ Cek Edge cache dulu
    const edgeCached = await cacheHelper.getEdge(cacheKey);
    if (edgeCached)
        return c.json(edgeCached);
    // 2️⃣ Cek KV cache
    const kvCached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (kvCached) {
        // update Edge cache di background
        cacheHelper.setEdge(cacheKey, kvCached, 60).catch(console.error);
        return c.json(kvCached);
    }
    // 3️⃣ Ambil dari DB
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const guest = await db.select().from(guests).where(eq(guests.id, guestId)).get();
    if (!guest)
        return c.json({ error: 'Guest not found' }, 403);
    const invitation = await db.select().from(invitations).where(eq(invitations.id, guest.invitationId)).get();
    if (!invitation)
        return c.json({ error: 'Invitation not found' }, 404);
    if (invitation.status !== 'published')
        return c.json({ error: 'Invitation not active' }, 403);
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date())
        return c.json({ error: 'Invitation expired' }, 410);
    const data = { invitation, guest };
    // Set KV + Edge cache
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 300); // KV 5 menit
    await cacheHelper.setEdge(cacheKey, data, 60); // Edge 1 menit
    return c.json(data);
});
/**
 * POST /:slug
 * Guest actions: RSVP, message, wishlist-claim
 * Invalidate cache semua guest supaya semua lihat update
 */
invite.post('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const body = await c.req.json();
    const guestId = body.guest;
    if (!guestId)
        return c.json({ error: 'Guest ID required' }, 400);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const guest = await db.select().from(guests).where(eq(guests.id, guestId)).get();
    if (!guest)
        return c.json({ error: 'Guest not found' }, 403);
    const invitation = await db.select().from(invitations).where(eq(invitations.id, guest.invitationId)).get();
    if (!invitation)
        return c.json({ error: 'Invitation not found' }, 404);
    switch (body.action) {
        case 'rsvp':
            await db.update(guests)
                .set({
                rsvpStatus: body.rsvpStatus,
                totalBringPeople: body.totalBringPeople || 0,
                rsvpAt: new Date(),
                mealPreference: body.mealPreference,
                dietaryNote: body.dietaryNote,
            })
                .where(eq(guests.id, guest.id))
                .run();
            break;
        case 'message':
            if (!body.message)
                return c.json({ error: 'Message required' }, 400);
            await db.update(guests)
                .set({ message: body.message, messageAt: new Date() })
                .where(eq(guests.id, guest.id))
                .run();
            break;
        case 'wishlist-claim':
            if (!body.wishlistId)
                return c.json({ error: 'Wishlist ID required' }, 400);
            const wishlist = await db.select().from(wishlistGifts)
                .where(and(eq(wishlistGifts.id, body.wishlistId), eq(wishlistGifts.invitationId, invitation.id)))
                .get();
            if (!wishlist)
                return c.json({ error: 'Wishlist not found' }, 404);
            const claimedList = await db.select().from(wishlistClaims)
                .where(eq(wishlistClaims.wishlistId, wishlist.id))
                .all();
            if (wishlist.maxClaim && claimedList.length >= wishlist.maxClaim) {
                return c.json({ error: 'Wishlist fully claimed' }, 403);
            }
            await db.insert(wishlistClaims).values({
                id: crypto.randomUUID(),
                wishlistId: wishlist.id,
                guestId: guest.id,
                guestName: guest.name,
                status: 'reserved',
                createdAt: new Date(),
                updatedAt: new Date(),
            }).run();
            break;
        default:
            return c.json({ error: 'Invalid action' }, 400);
    }
    // 🔄 Invalidate cache semua guest
    const allGuests = await db.select().from(guests).where(eq(guests.invitationId, invitation.id)).all();
    for (const g of allGuests) {
        const key = cacheHelper.getInvitationKey(slug, g.id);
        await cacheHelper.delete(c.env.CACHE, key);
        await cacheHelper.deleteEdge(key);
    }
    return c.json({ message: 'Action completed' });
});
export default invite;
