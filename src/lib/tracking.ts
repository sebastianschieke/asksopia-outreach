import { db, events, recipients } from './db';
import { eq } from 'drizzle-orm';
import type { RecipientSummary, EngagementStatus } from './types';

/**
 * Compute engagement status based on event data
 * Ported from Asset-Manager/server/db.ts - computeRecipientSummary
 *
 * Rules:
 * - NO_INTEREST: User clicked "no interest"
 * - HOT: One of:
 *   - User clicked "book"
 *   - Video watched 75%+
 *   - Email requested AND video watched 25%+
 *   - 2+ visits AND video watched 50%+
 * - WARM: One of:
 *   - Video watched 50%+
 *   - Video started
 *   - Email requested
 * - COLD: Default
 */
export async function computeRecipientStatus(recipientId: number): Promise<EngagementStatus> {
  const recipientEvents = await db
    .select()
    .from(events)
    .where(eq(events.recipient_id, recipientId));

  const pageViews = recipientEvents.filter((e) => e.event_type === 'page_view');
  const videoEvents = recipientEvents.filter((e) => e.event_type.startsWith('video_'));
  const ctaEvents = recipientEvents.filter((e) => e.event_type === 'cta_click');

  const uniqueSessions = new Set(pageViews.map((e) => e.session_id));
  const maxVideoPercent = Math.max(0, ...videoEvents.map((e) => e.percent || 0));
  const videoStarted = videoEvents.some((e) => e.event_type === 'video_start');

  // Get the last CTA action
  const lastCta = ctaEvents.length > 0 ? ctaEvents[ctaEvents.length - 1].event_value : null;

  let status: EngagementStatus = 'cold';

  if (lastCta === 'no_interest') {
    status = 'no_interest';
  } else if (
    lastCta === 'book' ||
    maxVideoPercent >= 0.75 ||
    (lastCta === 'email' && maxVideoPercent >= 0.25) ||
    (uniqueSessions.size >= 2 && maxVideoPercent >= 0.5)
  ) {
    status = 'hot';
  } else if (maxVideoPercent >= 0.5 || videoStarted || lastCta === 'email') {
    status = 'warm';
  }

  return status;
}

/**
 * Get complete recipient summary with engagement metrics
 */
export async function getRecipientSummary(recipientId: number): Promise<RecipientSummary | null> {
  const recipient = await db.query.recipients.findFirst({
    where: eq(recipients.id, recipientId),
  });

  if (!recipient) {
    return null;
  }

  const recipientEvents = await db
    .select()
    .from(events)
    .where(eq(events.recipient_id, recipientId));

  const pageViews = recipientEvents.filter((e) => e.event_type === 'page_view');
  const videoEvents = recipientEvents.filter((e) => e.event_type.startsWith('video_'));
  const ctaEvents = recipientEvents.filter((e) => e.event_type === 'cta_click');

  const uniqueSessions = new Set(pageViews.map((e) => e.session_id));
  const maxVideoPercent = Math.max(0, ...videoEvents.map((e) => e.percent || 0));
  const videoStarted = videoEvents.some((e) => e.event_type === 'video_start');

  const allEvents = [...recipientEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const lastActivity = allEvents.length > 0 ? allEvents[0].created_at : null;
  const lastCta = ctaEvents.length > 0 ? ctaEvents[ctaEvents.length - 1].event_value : null;

  const status = await computeRecipientStatus(recipientId);

  return {
    ...recipient,
    status,
    page_visits: pageViews.length,
    max_video_percent: maxVideoPercent,
    last_cta: lastCta,
    last_activity: lastActivity,
    video_started: videoStarted,
    repeat_visits: uniqueSessions.size,
  };
}

/**
 * Get summaries for all recipients
 */
export async function getAllRecipientSummaries(): Promise<RecipientSummary[]> {
  const allRecipients = await db.select().from(recipients);

  const summaries = await Promise.all(
    allRecipients.map((r) => getRecipientSummary(r.id))
  );

  return summaries.filter((s): s is RecipientSummary => s !== null);
}
