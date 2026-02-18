import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, letterTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generateFullLetter } from '@/lib/claude';
import type { Recipient, LetterTemplate } from '@/lib/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

function stripAnrede(html: string): string {
  // Remove German salutations Claude may output despite instructions
  return html
    .replace(/^\s*<p>\s*(Sehr geehrte[rn]?|Liebe[r]?|Guten Tag)[^<]{0,150}<\/p>\s*/i, '')
    .trimStart();
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

    // Fetch letter template (used as reference for Claude)
    let template: LetterTemplate | null = null;

    if (recipient.industry) {
      const industryTemplate = await db
        .select()
        .from(letterTemplates)
        .where(eq(letterTemplates.industry, recipient.industry))
        .limit(1);
      template = (industryTemplate[0] || null) as unknown as LetterTemplate | null;
    }

    if (!template) {
      const defaultTemplate = await db
        .select()
        .from(letterTemplates)
        .where(eq(letterTemplates.is_default, true))
        .limit(1);
      template = (defaultTemplate[0] || null) as unknown as LetterTemplate | null;
    }

    if (!template) {
      return NextResponse.json({ error: 'No letter template found. Please seed a default template.' }, { status: 404 });
    }

    // Strip HTML tags from template to create a clean reference text for Claude
    // Replace [Firma] placeholder with the actual company name
    const templateReference = (template.body_html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\{qr_code\}\}/g, '[QR-Code hier]')
      .replace(/\[Firma\]/g, recipient.company || 'Ihrem Unternehmen')
      .trim();

    // Generate full letter via Claude
    let fullLetterHtml = await generateFullLetter(
      recipient.first_name || '',
      recipient.last_name || '',
      recipient.company,
      recipient.signal_category,
      recipient.signal_description,
      templateReference
    );

    // Strip any salutation Claude may have added despite instructions
    fullLetterHtml = stripAnrede(fullLetterHtml);

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
