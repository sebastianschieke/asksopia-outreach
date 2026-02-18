import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, events } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { pushEngagementToClickUp } from '@/lib/clickup';

/**
 * GET /api/cron/push
 * Called automatically by Vercel Cron every hour.
 * Vercel sends Authorization: Bearer ${CRON_SECRET} — verified below.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Push all recipients with activity in the last 2 hours (overlap to avoid gaps)
    const recentActivity = await db
      .selectDistinct({ recipient_id: events.recipient_id })
      .from(events)
      .where(sql`created_at > NOW() - INTERVAL '2 hours'`);

    const recipientIds = recentActivity.map((r) => r.recipient_id);

    if (recipientIds.length === 0) {
      return NextResponse.json({ success: true, pushed: 0, message: 'No recent activity' });
    }

    let pushed = 0;
    const errors: string[] = [];

    for (const recipientId of recipientIds) {
      try {
        await pushEngagementToClickUp(recipientId);
        pushed++;
      } catch (error) {
        errors.push(`Recipient ${recipientId}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    console.log(`[cron/push] Pushed ${pushed}/${recipientIds.length} recipients`);

    return NextResponse.json({
      success: true,
      pushed,
      total: recipientIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[cron/push] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
