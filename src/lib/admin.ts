/**
 * Admin utilities for manual database operations
 * These are not exposed via API - for development/admin use only
 */

import { db, recipients, events, letterTemplates, landingPageTemplates } from './db';
import { eq, sql } from 'drizzle-orm';
import type { Recipient, LetterTemplate, LandingPageTemplate, InsertLetterTemplate, InsertLandingPageTemplate } from './types';

/**
 * Get all recipients with optional filtering
 */
export async function getAllRecipients(limit: number = 100): Promise<Recipient[]> {
  return await db
    .select()
    .from(recipients)
    .orderBy(sql`created_at DESC`)
    .limit(limit);
}

/**
 * Get recipient by ID
 */
export async function getRecipientById(id: number): Promise<Recipient | undefined> {
  const result = await db
    .select()
    .from(recipients)
    .where(eq(recipients.id, id))
    .limit(1);
  return result[0];
}

/**
 * Search recipients
 */
export async function searchRecipients(query: string): Promise<Recipient[]> {
  return await db
    .select()
    .from(recipients)
    .where(
      sql`${recipients.first_name} ILIKE ${'%' + query + '%'}
        OR ${recipients.last_name} ILIKE ${'%' + query + '%'}
        OR ${recipients.company} ILIKE ${'%' + query + '%'}
        OR ${recipients.email} ILIKE ${'%' + query + '%'}`
    );
}

/**
 * Get template by ID
 */
export async function getTemplateById(id: number): Promise<LetterTemplate | undefined> {
  const result = await db
    .select()
    .from(letterTemplates)
    .where(eq(letterTemplates.id, id))
    .limit(1);
  return result[0];
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<LetterTemplate[]> {
  return await db
    .select()
    .from(letterTemplates)
    .orderBy(sql`is_default DESC, name ASC`);
}

/**
 * Create letter template
 */
export async function createTemplate(data: InsertLetterTemplate): Promise<number> {
  const result = await db
    .insert(letterTemplates)
    .values(data)
    .returning({ id: letterTemplates.id });
  return result[0]?.id || 0;
}

/**
 * Update letter template
 */
export async function updateTemplate(id: number, data: Partial<InsertLetterTemplate>): Promise<void> {
  await db
    .update(letterTemplates)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(letterTemplates.id, id));
}

/**
 * Delete letter template
 */
export async function deleteTemplate(id: number): Promise<void> {
  await db.delete(letterTemplates).where(eq(letterTemplates.id, id));
}

/**
 * Get landing page template by ID
 */
export async function getLandingTemplateById(id: number): Promise<LandingPageTemplate | undefined> {
  const result = await db
    .select()
    .from(landingPageTemplates)
    .where(eq(landingPageTemplates.id, id))
    .limit(1);
  return result[0];
}

/**
 * Get all landing page templates
 */
export async function getAllLandingTemplates(): Promise<LandingPageTemplate[]> {
  return await db
    .select()
    .from(landingPageTemplates)
    .orderBy(sql`is_default DESC, name ASC`);
}

/**
 * Create landing page template
 */
export async function createLandingTemplate(data: InsertLandingPageTemplate): Promise<number> {
  const result = await db
    .insert(landingPageTemplates)
    .values(data)
    .returning({ id: landingPageTemplates.id });
  return result[0]?.id || 0;
}

/**
 * Update landing page template
 */
export async function updateLandingTemplate(id: number, data: Partial<InsertLandingPageTemplate>): Promise<void> {
  await db
    .update(landingPageTemplates)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(landingPageTemplates.id, id));
}

/**
 * Delete landing page template
 */
export async function deleteLandingTemplate(id: number): Promise<void> {
  await db.delete(landingPageTemplates).where(eq(landingPageTemplates.id, id));
}

/**
 * Get events for a recipient
 */
export async function getRecipientEvents(recipientId: number) {
  return await db
    .select()
    .from(events)
    .where(eq(events.recipient_id, recipientId))
    .orderBy(sql`created_at DESC`);
}

/**
 * Clear all events for a recipient (use with caution)
 */
export async function clearRecipientEvents(recipientId: number): Promise<void> {
  await db.delete(events).where(eq(events.recipient_id, recipientId));
}

/**
 * Delete a recipient and all related events
 */
export async function deleteRecipient(id: number): Promise<void> {
  await db.delete(events).where(eq(events.recipient_id, id));
  await db.delete(recipients).where(eq(recipients.id, id));
}

/**
 * Get statistics
 */
export async function getStatistics() {
  const totalRecipients = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(recipients);

  const totalEvents = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events);

  const recentEvents = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(events)
    .where(sql`created_at > NOW() - INTERVAL '7 days'`);

  return {
    totalRecipients: totalRecipients[0]?.count || 0,
    totalEvents: totalEvents[0]?.count || 0,
    recentEvents: recentEvents[0]?.count || 0,
  };
}
