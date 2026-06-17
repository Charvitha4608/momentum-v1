import { and, eq, or } from "drizzle-orm"

import { db } from "@/lib/db"
import { friendships } from "@/lib/db/schema"

/** All accepted friend user IDs for the given user. */
export async function getFriendIds(userId: string) {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      ),
    )
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId))
}
