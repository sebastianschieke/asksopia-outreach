import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, events } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Helper: Check admin authorization
 */
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * GET /api/admin/stats
 * Returns dashboard stats
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Total recipients
    const totalRecipientsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recipients);
    const totalRecipients = totalRecipientsResult[0]?.count || 0;

    // Page visits
    const pageVisitsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(events)
      .where(sql`event_type = 'page_view'`);
    const pageVisits = pageVisitsResult[0]?.count || 0;

    // Video 50%+ watched
    const video50Result = await db
      .select({ count: sql<number>`COUNT(DISTINCT recipient_id)` })
      .from(events)
      .where(sql`event_type LIKE 'video_%' AND percent >= 50`);
    const video50Plus = video50Result[0]?.count || 0;

    // CTA clicks
    const ctaClicksResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(events)
      .where(sql`event_type = 'cta_click'`);
    const ctaClicks = ctaClicksResult[0]?.count || 0;

    return NextResponse.json({
      totalRecipients,
      pageVisits,
      video50Plus,
      ctaClicks,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
