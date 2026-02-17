import { NextRequest, NextResponse } from 'next/server';
import { db, recipients, letterTemplates, events } from '@/lib/db';
import { eq, sql, and } from 'drizzle-orm';
import { generateLetterPdf, getLetterFilename } from '@/lib/pdf';
import { generatePersonalizedIntro } from '@/lib/claude';
import { computeRecipientStatus } from '@/lib/tracking';
import archiver from 'archiver';
import { Readable } from 'stream';
import type { Recipient, LetterTemplate } from '@/lib/types';

/**
 * Helper: Check admin authorization
 */
function checkAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${process.env.ADMIN_PASSWORD}`;
  return authHeader === expectedAuth;
}

/**
 * POST /api/batch-letters
 * Generate PDF letters for multiple recipients and return as ZIP
 * Body:
 *   - status?: 'hot' | 'warm' | 'cold' | 'no_interest' (optional)
 *   - signal_category?: string (optional)
 *   - personalize?: boolean (default true - use Claude for intro)
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status: filterStatus, signal_category: filterSignal, personalize = true } = body;

    // Fetch all recipients
    const allRecipients = await db.select().from(recipients).orderBy(sql`created_at DESC`);

    // Filter recipients based on criteria
    let filteredRecipients: (Recipient & Record<string, unknown>)[] = [];

    for (const recipient of allRecipients) {
      const r = recipient as unknown as Recipient & Record<string, unknown>;
      // Filter by signal category
      if (filterSignal && r.signal_category !== filterSignal) {
        continue;
      }

      // Filter by engagement status
      if (filterStatus) {
        const status = await computeRecipientStatus(r.id as number);
        if (status !== filterStatus) {
          continue;
        }
      }

      filteredRecipients.push(r);
    }

    if (filteredRecipients.length === 0) {
      return NextResponse.json({ error: 'No recipients match the filter criteria' }, { status: 400 });
    }

    // Create ZIP archive in memory
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Use a PassThrough stream to collect the data
    const PassThrough = (await import('stream')).PassThrough;
    const zipStream = new PassThrough();

    archive.pipe(zipStream);

    // Generate PDFs and add to archive
    let generated = 0;
    const errors: string[] = [];

    for (const recipient of filteredRecipients) {
      try {
        // Fetch letter template
        let template: LetterTemplate | null = null;

        if (recipient.industry) {
          const industryTemplate = await db
            .select()
            .from(letterTemplates)
            .where(eq(letterTemplates.industry, recipient.industry as string))
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
          errors.push(`${recipient.first_name} ${recipient.last_name}: No template found`);
          continue;
        }

        // Generate personalized intro if requested
        let personalizedIntro: string | undefined;
        if (personalize) {
          try {
            personalizedIntro = await generatePersonalizedIntro(
              (recipient.first_name as string) || '',
              recipient.company as string | null,
              recipient.signal_category as string | null,
              recipient.signal_description as string | null
            );
          } catch (error) {
            console.warn(`Failed to personalize for recipient ${recipient.id}:`, error);
            personalizedIntro = undefined;
          }
        }

        // Generate PDF
        const pdfBuffer = await generateLetterPdf(recipient as Recipient, template, personalizedIntro);
        const filename = getLetterFilename(recipient as Recipient);

        archive.append(pdfBuffer, { name: filename });
        generated++;
      } catch (error) {
        errors.push(
          `${recipient.first_name} ${recipient.last_name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Collect the ZIP data
    const zipChunks: Buffer[] = [];

    zipStream.on('data', (chunk: Buffer) => {
      zipChunks.push(chunk);
    });

    await new Promise<void>((resolve, reject) => {
      zipStream.on('end', () => resolve());
      zipStream.on('error', reject);
      archive.on('error', reject);
    });

    const zipBuffer = Buffer.concat(zipChunks);

    const timestamp = new Date().toISOString().split('T')[0];
    const zipFilename = `asksopia-letters-${timestamp}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Batch letters error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
