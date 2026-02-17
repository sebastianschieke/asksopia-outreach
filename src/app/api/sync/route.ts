import { NextRequest, NextResponse } from 'next/server';
import { syncFromClickUp } from '@/lib/clickup';

/**
 * POST /api/sync
 * Sync recipients from ClickUp list (admin protected)
 */
export async function POST(request: NextRequest) {
  try {
    // Simple password protection via Authorization header
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${process.env.SYNC_PASSWORD}`;

    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const listId = process.env.CLICKUP_LIST_ID;
    if (!listId) {
      return NextResponse.json({ error: 'CLICKUP_LIST_ID not configured' }, { status: 500 });
    }

    const result = await syncFromClickUp(listId);

    return NextResponse.json({
      success: true,
      created: result.created,
      updated: result.updated,
      message: `Synced ${result.created + result.updated} recipients (${result.created} new, ${result.updated} updated)`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
