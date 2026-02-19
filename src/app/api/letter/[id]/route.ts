import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, letterTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generateLetterPdf, getLetterFilename } from '@/lib/pdf';
import { generateFullLetter } from '@/lib/claude';
import type { Recipient, LetterTemplate } from '@/lib/types';

interface LetterRequestBody {
  letterHtml?: string; // Full letter HTML from the editor
}

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
      const allLetterTemplates = await db
        .select()
        .from(letterTemplates)
        .where(eq(letterTemplates.is_default, false));
      const matched = (allLetterTemplates as unknown as LetterTemplate[]).find((t) =>
        t.industry
          ?.split(',')
          .map((s) => s.trim().toLowerCase())
          .includes(recipient.industry!.toLowerCase())
      );
      template = matched || null;
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

    // Generate PDF using template directly (no Claude personalization)
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
 * Generate PDF letter with full Claude-written content.
 * Accepts letterHtml from the editor, or generates via Claude if not provided.
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

    // Parse request body
    let body: LetterRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // No body provided — will generate via Claude
    }

    // Determine the letter HTML
    let letterHtml: string;

    if (body.letterHtml) {
      // Use edited letter from the modal
      letterHtml = body.letterHtml;
    } else {
      letterHtml = await generateFullLetter(
        recipient.first_name || '',
        recipient.last_name || '',
        recipient.company,
        recipient.industry,
        recipient.signal_category,
        recipient.signal_description,
        recipient.anrede
      );
    }

    // Create a synthetic template with the full letter HTML for PDF generation
    const effectiveTemplate: LetterTemplate = {
      id: 0,
      name: 'Generated',
      industry: null,
      subject_line: 'Persönliche Einladung',
      body_html: letterHtml,
      vimeo_video_id: null,
      is_default: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Generate PDF — no placeholder substitution needed (Claude wrote the full letter)
    const pdfBuffer = await generateLetterPdf(recipient, effectiveTemplate);

    // Save the letter content to DB for audit trail
    try {
      await db
        .update(recipients)
        .set({
          letter_personalized_intro: letterHtml,
          letter_generated_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(recipients.id, recipientId));
    } catch (dbErr) {
      console.error('Failed to save letter content to DB:', dbErr);
    }

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
