import { NextRequest, NextResponse } from 'next/server';
import { db, events, recipients } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { eventSchema } from '@/lib/types';
import { pushEngagementToClickUp } from '@/lib/clickup';

/**
 * POST /api/event
 * Log tracking event and compute engagement status
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validated = eventSchema.parse(body);

    // Look up recipient by token
    const recipient = await db
      .select()
      .from(recipients)
      .where(eq(recipients.token, validated.token))
      .limit(1);

    if (recipient.length === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const recipientId = recipient[0].id;

    // Log event
    await db.insert(events).values({
      recipient_id: recipientId,
      session_id: validated.session_id,
      event_type: validated.event_type,
      event_value: validated.event_value ?? null,
      percent: validated.percent ?? null,
      url_path: validated.url_path ?? null,
      referrer: validated.referrer ?? null,
      user_agent: validated.user_agent ?? null,
    });

    // Push status to ClickUp if this is a CTA event that might change status
    if (validated.event_type === 'cta_click') {
      await pushEngagementToClickUp(recipientId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Event tracking error:', error);
    if (error instanceof Error && 'issues' in error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
