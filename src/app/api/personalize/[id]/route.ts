import { NextRequest, NextResponse } from 'next/server';
import { db, recipients } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generatePersonalizedIntro } from '@/lib/claude';
import type { Recipient } from '@/lib/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Helper: Check admin authorization
 */
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * POST /api/personalize/[id]
 * Generate Claude AI personalized intro for a recipient
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!checkAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const recipientId = parseInt(id, 10);

    if (isNaN(recipientId)) {
      return NextResponse.json({ error: 'Invalid recipient ID' }, { status: 400 });
    }

    // Fetch recipient
    const recipientResult = await db
      .select()
      .from(recipients)
      .where(eq(recipients.id, recipientId))
      .limit(1);

    if (recipientResult.length === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const recipient = recipientResult[0] as unknown as Recipient;

    // Generate personalized intro
    const personalizedIntro = await generatePersonalizedIntro(
      recipient.first_name || '',
      recipient.company,
      recipient.signal_category,
      recipient.signal_description
    );

    return NextResponse.json({
      success: true,
      intro: personalizedIntro,
    });
  } catch (error) {
    console.error('Personalization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
