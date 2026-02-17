import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, events } from '@/lib/db';
import { eq, sql, and } from 'drizzle-orm';
import { getRecipientSummary } from '@/lib/tracking';
import type { RecipientSummary } from '@/lib/types';

/**
 * Helper: Check admin authorization
 */
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * GET /api/admin/recipients
 * Returns recipients with engagement summaries
 * Query params:
 *   - status: 'hot' | 'warm' | 'cold' | 'no_interest' (optional)
 *   - signal: signal_category (optional)
 *   - limit: number (default 100)
 *   - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const signal = searchParams.get('signal');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch recipients with optional filtering
    let query = db.select().from(recipients);

    if (signal) {
      query = query.where(eq(recipients.signal_category, signal)) as any;
    }

    const allRecipients = await query.orderBy(sql`created_at DESC`);

    // Fetch summaries for all matching recipients
    const summaries: RecipientSummary[] = [];

    for (const recipient of allRecipients) {
      const summary = await getRecipientSummary(recipient.id);
      if (summary) {
        // Apply status filter if specified
        if (!status || summary.status === status) {
          summaries.push(summary);
        }
      }
    }

    // Apply pagination
    const paginatedSummaries = summaries.slice(offset, offset + limit);

    return NextResponse.json({
      total: summaries.length,
      limit,
      offset,
      data: paginatedSummaries,
    });
  } catch (error) {
    console.error('Recipients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
