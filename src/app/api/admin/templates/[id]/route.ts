import { NextRequest, NextResponse } from 'next/server';
import { db, landingPageTemplates } from '@/lib/db';
import { eq } from 'drizzle-orm';

function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  return authHeader === `Bearer ${process.env.ADMIN_PASSWORD}`;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/admin/templates/[id]
 * Update a landing page template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const templateId = parseInt(id);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { name, industry, headline, subheadline, cta_button_text, body_html, vimeo_video_id, is_default } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [updated] = await db
      .update(landingPageTemplates)
      .set({
        name: name.trim(),
        industry: industry?.trim() || null,
        headline: headline?.trim() || null,
        subheadline: subheadline?.trim() || null,
        cta_button_text: cta_button_text?.trim() || null,
        body_html: body_html?.trim() || null,
        vimeo_video_id: vimeo_video_id?.trim() || null,
        is_default: is_default || false,
        updated_at: new Date(),
      })
      .where(eq(landingPageTemplates.id, templateId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Templates PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/templates/[id]
 * Delete a landing page template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const templateId = parseInt(id);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await db.delete(landingPageTemplates).where(eq(landingPageTemplates.id, templateId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Templates DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
