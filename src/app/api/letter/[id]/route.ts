import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, letterTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generateLetterPdf, getLetterFilename } from '@/lib/pdf';
import { generatePersonalizedIntro } from '@/lib/claude';
import type { Recipient, LetterTemplate } from '@/lib/types';

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
 * GET /api/letter/[id]
 * Generate PDF letter for a recipient (without personalization)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Fetch letter template by industry, fallback to default
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
      return NextResponse.json({ error: 'No letter template found' }, { status: 404 });
    }

    // Generate PDF
    const pdfBuffer = await generateLetterPdf(recipient, template);

    const filename = getLetterFilename(recipient);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Letter generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/letter/[id]
 * Generate PDF letter with Claude personalization
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

    // Fetch letter template by industry, fallback to default
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
      return NextResponse.json({ error: 'No letter template found' }, { status: 404 });
    }

    // Generate personalized intro using Claude
    const personalizedIntro = await generatePersonalizedIntro(
      recipient.first_name || '',
      recipient.company,
      recipient.signal_category,
      recipient.signal_description
    );

    // Generate PDF with personalization
    const pdfBuffer = await generateLetterPdf(recipient, template, personalizedIntro);

    const filename = getLetterFilename(recipient);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Letter generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
