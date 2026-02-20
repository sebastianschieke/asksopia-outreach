import { NextRequest, NextResponse } from 'next/server';
import { db, events } from '@/lib/db';
import { inArray } from 'drizzle-orm';

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * POST /api/admin/reset-events
 * Body: { recipientIds: number[] }
 * Deletes all events for the given recipient IDs (useful for resetting test counters).
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { recipientIds } = body as { recipientIds: number[] };

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return NextResponse.json({ error: 'recipientIds must be a non-empty array' }, { status: 400 });
    }

    const deleted = await db
      .delete(events)
      .where(inArray(events.recipient_id, recipientIds))
      .returning({ id: events.id });

    return NextResponse.json({ deleted: deleted.length, recipientIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
