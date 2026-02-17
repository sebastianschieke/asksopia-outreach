import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, landingPageTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { Recipient, LandingPageTemplate } from '@/lib/types';

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || 'https://calendly.com/asksopia';

interface RouteParams {
  params: Promise<{
    token: string;
  }>;
}

/**
 * GET /api/landing/[token]
 * Fetch landing page data for a recipient
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // Fetch recipient
    const recipientResult = await db
      .select()
      .from(recipients)
      .where(eq(recipients.token, token))
      .limit(1);

    if (recipientResult.length === 0) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const recipient = recipientResult[0] as unknown as Recipient;

    // Fetch landing template by industry, fallback to default
    let template: LandingPageTemplate | null = null;

    if (recipient.industry) {
      const industryTemplate = await db
        .select()
        .from(landingPageTemplates)
        .where(eq(landingPageTemplates.industry, recipient.industry))
        .limit(1);
      template = (industryTemplate[0] || null) as unknown as LandingPageTemplate | null;
    }

    if (!template) {
      const defaultTemplate = await db
        .select()
        .from(landingPageTemplates)
        .where(eq(landingPageTemplates.is_default, true))
        .limit(1);
      template = (defaultTemplate[0] || null) as unknown as LandingPageTemplate | null;
    }

    return NextResponse.json({
      recipient,
      vimeoVideoId: template?.vimeo_video_id || '',
      bookingUrl: BOOKING_URL,
      landingTemplate: template,
    });
  } catch (error) {
    console.error('Landing page error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
