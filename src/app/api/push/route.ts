import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, events } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { pushEngagementToClickUp } from '@/lib/clickup';

/**
 * Helper: Check admin authorization
 */
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * POST /api/push
 * Push engagement data back to ClickUp for all recipients with recent activity
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all recipients with activity in the last 24 hours
    const recentActivity = await db
      .selectDistinct({ recipient_id: events.recipient_id })
      .from(events)
      .where(sql`created_at > NOW() - INTERVAL '24 hours'`);

    const recipientIds = recentActivity.map((r) => r.recipient_id);

    if (recipientIds.length === 0) {
      return NextResponse.json({
        success: true,
        pushed: 0,
        message: 'No recent activity to push',
      });
    }

    // Push engagement for each recipient
    let pushed = 0;
    const errors: string[] = [];

    for (const recipientId of recipientIds) {
      try {
        await pushEngagementToClickUp(recipientId);
        pushed++;
      } catch (error) {
        errors.push(`Recipient ${recipientId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      pushed,
      total: recipientIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Pushed engagement data for ${pushed}/${recipientIds.length} recipients`,
    });
  } catch (error) {
    console.error('Push engagement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
