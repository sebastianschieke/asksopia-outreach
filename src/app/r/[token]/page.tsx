import { notFound } from 'next/navigation';
import { db, recipients, landingPageTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { LandingClient } from './landing-client';
import type { Recipient, LandingPageTemplate } from '@/lib/types';

const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL || 'https://calendly.com/sebastianschieke/knowledgeaiskassessment';

async function getLandingPageData(token: string) {
  try {
    // Fetch recipient
    const recipientResult = await db
      .select()
      .from(recipients)
      .where(eq(recipients.token, token))
      .limit(1);

    if (recipientResult.length === 0) {
      return null;
    }

    const recipient = recipientResult[0] as unknown as Recipient;

    // Fetch landing template by industry (supports comma-separated list in template.industry), fallback to default
    let template: LandingPageTemplate | null = null;

    if (recipient.industry) {
      const allTemplates = await db
        .select()
        .from(landingPageTemplates)
        .where(eq(landingPageTemplates.is_default, false));
      const matched = (allTemplates as unknown as LandingPageTemplate[]).find((t) =>
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
        .from(landingPageTemplates)
        .where(eq(landingPageTemplates.is_default, true))
        .limit(1);
      template = (defaultTemplate[0] || null) as unknown as LandingPageTemplate | null;
    }

    return {
      recipient,
      template,
    };
  } catch (error) {
    console.error('Error fetching landing page data:', error);
    return null;
  }
}

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function LandingPage({ params }: PageProps) {
  const { token } = await params;

  const data = await getLandingPageData(token);

  if (!data) {
    notFound();
  }

  const { recipient, template } = data;

  // Use the pre-translated German signal (generated at import time).
  // Falls back to the original English if not yet translated.
  const recipientDe: Recipient = {
    ...recipient,
    signal_description: recipient.signal_description_de ?? recipient.signal_description,
  };

  return (
    <LandingClient
      token={token}
      recipient={recipientDe}
      vimeoVideoId={template?.vimeo_video_id || ''}
      bookingUrl={BOOKING_URL}
      landingTemplate={template}
    />
  );
}

/**
 * Generate static parameters for common tokens
 * Can be expanded with actual token list if needed
 */
export async function generateStaticParams() {
  return [];
}
