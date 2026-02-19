import { NextRequest, NextResponse } from 'next/server';
import { db, recipients } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generateFullLetter } from '@/lib/claude';
import type { Recipient } from '@/lib/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * POST /api/letter/[id]/preview
 * Generate full personalized letter via Claude for editing in the modal.
 * Returns: recipient info + full letter HTML (ready to edit).
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

    // Generate full letter via Claude
    const fullLetterHtml = await generateFullLetter(
      recipient.first_name || '',
      recipient.last_name || '',
      recipient.company,
      recipient.industry,
      recipient.signal_category,
      recipient.signal_description,
      recipient.anrede
    );

    return NextResponse.json({
      recipient: {
        id: recipient.id,
        first_name: recipient.first_name,
        last_name: recipient.last_name,
        company: recipient.company,
        street: recipient.street,
        city: recipient.city,
        postal_code: recipient.postal_code,
        country: recipient.country,
        anrede: recipient.anrede,
        signal_category: recipient.signal_category,
        signal_description: recipient.signal_description,
        token: recipient.token,
      },
      letterHtml: fullLetterHtml,
    });
  } catch (error) {
    console.error('Letter preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
