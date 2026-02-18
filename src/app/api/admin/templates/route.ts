import { NextRequest, NextResponse } from 'next/server';
import { db, landingPageTemplates } from '@/lib/db';
import { sql } from 'drizzle-orm';

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

/**
 * GET /api/admin/templates
 * List all landing page templates
 */
export async function GET(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const templates = await db
      .select()
      .from(landingPageTemplates)
      .orderBy(sql`created_at DESC`);
    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/templates
 * Create a new landing page template
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, industry, headline, subheadline, cta_button_text, body_html, vimeo_video_id, is_default } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [template] = await db
      .insert(landingPageTemplates)
      .values({
        name: name.trim(),
        industry: industry?.trim() || null,
        headline: headline?.trim() || null,
        subheadline: subheadline?.trim() || null,
        cta_button_text: cta_button_text?.trim() || null,
        body_html: body_html?.trim() || null,
        vimeo_video_id: vimeo_video_id?.trim() || null,
        is_default: is_default || false,
      })
      .returning();

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error('Templates POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
