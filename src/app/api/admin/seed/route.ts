import { NextRequest, NextResponse } from 'next/server';
import { db, landingPageTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

/**
 * Consulting industry values (DACH context).
 * Comma-separated — template matching splits on "," and does a case-insensitive check.
 */
const CONSULTING_INDUSTRIES = [
  'Management Consulting',
  'IT Consulting',
  'Strategy Consulting',
  'HR Consulting',
  'Financial Advisory',
  'Operations Consulting',
  'Interim Management',
  'Transformation',
].join(',');

/**
 * POST /api/admin/seed
 * Creates the default consulting landing page template if it does not exist yet.
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if consulting template already exists
    const existing = await db
      .select()
      .from(landingPageTemplates)
      .where(eq(landingPageTemplates.name, 'Consulting'))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ message: 'Consulting template already exists', data: existing[0] });
    }

    const [template] = await db
      .insert(landingPageTemplates)
      .values({
        name: 'Consulting',
        industry: CONSULTING_INDUSTRIES,
        headline: null,           // auto-generates "Hallo Herr/Frau [LastName]"
        subheadline: null,        // auto-generates signal sentence
        cta_button_text: 'Termin vereinbaren',
        body_html: null,
        vimeo_video_id: null,     // set this in the admin UI once you have the Vimeo ID
        is_default: false,
      })
      .returning();

    return NextResponse.json({ message: 'Consulting template created', data: template }, { status: 201 });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
