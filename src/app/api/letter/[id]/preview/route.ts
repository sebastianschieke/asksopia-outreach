import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, letterTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { generatePersonalizedIntro } from '@/lib/claude';
import type { Recipient, LetterTemplate } from '@/lib/types';

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
 * Fetch recipient data + Claude-generated personalized intro for the editor
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

    // Fetch letter template
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

    // Generate personalized intro using Claude
    const personalizedIntro = await generatePersonalizedIntro(
      recipient.first_name || '',
      recipient.company,
      recipient.signal_category,
      recipient.signal_description
    );

    // Resolve placeholders in template body (but keep {{personalized_intro}} separate)
    const firstName = recipient.first_name || '';
    const lastName = recipient.last_name || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    const formatAnrede = (anrede: string | null | undefined): string => {
      if (!anrede) return '';
      switch (anrede.toLowerCase()) {
        case 'herr': return `Sehr geehrter Herr ${lastName},`;
        case 'frau': return `Sehr geehrte Frau ${lastName},`;
        case 'dear': return `Dear ${firstName},`;
        default: return '';
      }
    };

    const resolvedBody = (template.body_html || '')
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{last_name\}\}/g, lastName)
      .replace(/\{\{full_name\}\}/g, fullName)
      .replace(/\{\{company\}\}/g, recipient.company || '')
      .replace(/\{\{industry\}\}/g, recipient.industry || '')
      .replace(/\{\{anrede\}\}/g, formatAnrede(recipient.anrede))
      .replace(/\{\{personalized_intro\}\}/g, '{{personalized_intro}}'); // Keep this placeholder

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
      personalizedIntro,
      templateBody: resolvedBody,
    });
  } catch (error) {
    console.error('Letter preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
