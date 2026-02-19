import { db, recipients } from './db';
import { eq } from 'drizzle-orm';
import { generateToken } from './tokens';
import { computeRecipientStatus } from './tracking';
import { translateSignalToGerman } from './claude';
import type { Recipient, ClickUpTask } from './types';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || '';

/**
 * ClickUp Custom Field IDs for the LinkedIn Outreach — DACH list
 * These are hardcoded for reliability — they don't change.
 */
const FIELD_IDS = {
  // Address
  street: '40253742-ad6f-4702-8e19-254fb31fa2fd',
  city: '474ea990-7882-4ce1-8d8a-7a688c16de9d',
  postalCode: '8dae8505-971d-4f37-a7c4-2c4dc0e63711',
  country: '33993e54-87d3-4190-b565-8b37061003d8',
  anrede: '1fffbaf6-8f2e-48db-94fe-ff7984588c6c',

  // Contact & Profile
  email: '0a4672fd-0bdf-4eeb-9e21-c87802a061d2',
  linkedinUrl: '0c763feb-767a-478d-b89d-89630bb7eb10',
  bookingUrl: 'a83fd506-6231-423b-a086-e4b88e081b53',

  // Outreach Tracking
  landingPageToken: 'b388a378-e480-45b9-a08b-ac6552ec71f8',
  engagementStatus: '789db1fd-ab0b-4ab3-a159-59364e3fcfd0',
  videoProgress: '94eff25c-f806-4259-8286-c1cf58c0e9fe',
  pageVisits: 'a9acc5b5-3bc7-4b5c-9120-37aaf0f4a2e7',
  lastActivity: 'c241ef45-e561-499e-b60f-0def533900a2',
  letterSent: '45b7c418-6ca2-4186-97c3-94b483cfdd88',

  // Signal
  signalCategory: 'f5313b5f-bdd8-4c82-b2f9-a10ab3829f4e',
  signalDescription: 'd5892399-edaa-4e45-8331-405a642aa58b',

  // Industry
  industry: '51ab00b5-daa0-4be3-a497-75d2564df235',
} as const;

/**
 * Engagement Status dropdown option IDs
 */
const ENGAGEMENT_STATUS_OPTIONS: Record<string, string> = {
  HOT: '0fa2e5b7-02fd-44a2-bdba-d8cb0b1fdd80',
  WARM: 'e8e6ac18-9ac3-44c1-bf10-e5aa06a23cf5',
  COLD: 'e3374233-ccd9-490e-846e-07def51fb46c',
  NO_INTEREST: '2b72452a-bb3d-4ef8-9655-18cafd5666a0',
  NEW: '22bdf767-5188-4d95-8e96-2b03961b99ae',
};

/**
 * Anrede dropdown option IDs
 */
const ANREDE_OPTIONS: Record<string, string> = {
  Herr: 'cf38286b-4f70-4053-bc08-26cc326c25df',
  Frau: '63ede71b-fee0-4076-a9a8-c1ce88cf8555',
};

/**
 * Industry dropdown option IDs
 */
const INDUSTRY_OPTIONS: Record<string, string> = {
  'Management Consulting': 'b57f8444-049d-4783-82b8-ea543636cfae',
  'IT Consulting': 'ed1d0439-790a-4d06-b4e3-f36a12f8cf0c',
  'Strategy Consulting': '73b5b013-b7c8-4c4c-af74-3a2d0c9c618c',
  'HR Consulting': 'e0160641-4942-4d0b-949c-a67cf477ef81',
  'Financial Advisory': '1454c1c1-ea4e-491a-8645-4314699dd535',
  'Operations Consulting': 'e5ecdefb-38b3-4371-b61a-4a7a5834b8d9',
  'Interim Management': 'd5c0b7e1-5a9f-4f63-9c72-2867a440bdc3',
  'Transformation': '22b85132-0789-487b-8ecd-cd315a610e03',
};

/**
 * Signal Category dropdown option IDs
 */
const SIGNAL_CATEGORY_OPTIONS: Record<string, string> = {
  Growth: '8e633c1c-7334-4ac0-8458-85df103dbcce',
  Decline: 'dad8ded8-8af6-450f-a323-1bfa9f04aa9f',
  'Leadership Change': 'a66aa6d8-8cad-44e2-8cf5-86d4168833e5',
  Funding: 'e854420f-6095-4058-b429-9210e0aa70f9',
  'Strategic Shift': 'b5071636-f535-48a5-b4a1-3345a7cc1a89',
};

/**
 * Fetch all tasks from a ClickUp list
 */
export async function getTasksFromList(listId: string): Promise<ClickUpTask[]> {
  try {
    const allTasks: ClickUpTask[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${CLICKUP_API_URL}/list/${listId}/task?include_subtasks=false&limit=100&page=${page}`,
        {
          headers: {
            Authorization: CLICKUP_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`ClickUp API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { tasks?: ClickUpTask[]; last_page?: boolean };
      const tasks = data.tasks || [];
      allTasks.push(...tasks);

      hasMore = !data.last_page && tasks.length === 100;
      page++;
    }

    return allTasks;
  } catch (error) {
    console.error('Error fetching ClickUp tasks:', error);
    return [];
  }
}

/**
 * Set a single custom field on a ClickUp task
 */
async function setCustomField(taskId: string, fieldId: string, value: unknown): Promise<void> {
  try {
    const response = await fetch(
      `${CLICKUP_API_URL}/task/${taskId}/field/${fieldId}`,
      {
        method: 'POST',
        headers: {
          Authorization: CLICKUP_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`Failed to set field ${fieldId} on task ${taskId}: ${err}`);
    }
  } catch (error) {
    console.error(`Error setting field ${fieldId} on task ${taskId}:`, error);
  }
}

/**
 * Parse task name to extract recipient info
 * Expected format: "FirstName LastName — Company (City)"
 */
function parseTaskName(taskName: string): {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  city: string | null;
} {
  const parts = taskName.split('—');
  const names = parts[0]?.trim().split(' ') || [];

  const firstName = names[0] || null;
  const lastName = names.slice(1).join(' ') || null;

  let company: string | null = null;
  let city: string | null = null;

  if (parts[1]) {
    const companyCity = parts[1].trim();
    const match = companyCity.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (match) {
      company = match[1].trim() || null;
      city = match[2].trim() || null;
    } else {
      company = companyCity || null;
    }
  }

  return { firstName, lastName, company, city };
}

/**
 * Get custom field value by field ID from a task
 * Handles different field types (text, url, email, dropdown, number, date)
 */
function getFieldValue(task: ClickUpTask, fieldId: string): unknown {
  if (!task.custom_fields) return null;
  const field = task.custom_fields.find((f) => f.id === fieldId);
  if (!field) return null;

  // For dropdown fields, resolve to option name
  // ClickUp may return either a numeric index or a UUID string as the value
  if (field.type === 'drop_down' && field.type_config?.options) {
    if (typeof field.value === 'number') {
      const option = field.type_config.options[field.value];
      return option?.name ?? null;
    }
    if (typeof field.value === 'string') {
      // Value is the option UUID — find by id
      const option = field.type_config.options.find(
        (o: { id: string; name: string }) => o.id === field.value
      );
      return option?.name ?? null;
    }
  }

  return field.value ?? null;
}

/**
 * Convert ClickUp task to Recipient data
 */
export function parseTaskToRecipient(task: ClickUpTask): Partial<Recipient> {
  const { firstName, lastName, company, city: parsedCity } = parseTaskName(task.name);

  // Pull all custom field values
  const street = getFieldValue(task, FIELD_IDS.street) as string | null;
  const city = (getFieldValue(task, FIELD_IDS.city) as string | null) || parsedCity;
  const postalCode = getFieldValue(task, FIELD_IDS.postalCode) as string | null;
  const country = (getFieldValue(task, FIELD_IDS.country) as string | null) || 'Germany';
  const anrede = getFieldValue(task, FIELD_IDS.anrede) as string | null;
  const email = getFieldValue(task, FIELD_IDS.email) as string | null;
  const linkedinUrl = getFieldValue(task, FIELD_IDS.linkedinUrl) as string | null;
  const bookingUrl = getFieldValue(task, FIELD_IDS.bookingUrl) as string | null;
  const signalCategory = getFieldValue(task, FIELD_IDS.signalCategory) as string | null;
  const signalDescription = getFieldValue(task, FIELD_IDS.signalDescription) as string | null;
  const industry = getFieldValue(task, FIELD_IDS.industry) as string | null;

  // Token: use existing or generate new
  const existingToken = getFieldValue(task, FIELD_IDS.landingPageToken) as string | null;
  const token = existingToken || generateToken(company, firstName, lastName);

  return {
    clickup_task_id: task.id,
    token,
    first_name: firstName,
    last_name: lastName,
    company,
    email,
    industry,
    linkedin_url: linkedinUrl,
    booking_url: bookingUrl,
    street,
    city,
    postal_code: postalCode,
    country,
    anrede,
    signal_category: signalCategory,
    signal_description: signalDescription,
  };
}

/**
 * Sync all tasks from ClickUp list to database
 */
export async function syncFromClickUp(listId: string): Promise<{ created: number; updated: number; errors: number }> {
  const tasks = await getTasksFromList(listId);
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const task of tasks) {
    try {
      const recipientData = parseTaskToRecipient(task);

      // Check if recipient exists
      const existing = await db
        .select()
        .from(recipients)
        .where(eq(recipients.clickup_task_id, task.id))
        .limit(1);

      // Translate signal description to German if not already done
      if (recipientData.signal_description) {
        const existingDe = existing[0]?.signal_description_de as string | null | undefined;
        const signalChanged = existing.length === 0 || (existing[0] as any)?.signal_description !== recipientData.signal_description;
        if (!existingDe || signalChanged) {
          recipientData.signal_description_de = await translateSignalToGerman(recipientData.signal_description);
        }
      }

      if (existing.length > 0) {
        // Update existing recipient
        await db
          .update(recipients)
          .set({
            ...recipientData,
            clickup_task_id: undefined, // Don't update the key
            updated_at: new Date(),
          } as any)
          .where(eq(recipients.clickup_task_id, task.id));
        updated++;
      } else {

        // Insert new recipient
        await db.insert(recipients).values({
          ...recipientData,
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        created++;

        // Write generated token back to ClickUp
        if (recipientData.token && !getFieldValue(task, FIELD_IDS.landingPageToken)) {
          await setCustomField(task.id, FIELD_IDS.landingPageToken, recipientData.token);
        }

        // Set initial engagement status to NEW
        await setCustomField(task.id, FIELD_IDS.engagementStatus, ENGAGEMENT_STATUS_OPTIONS.NEW);
      }
    } catch (error) {
      console.error(`Error syncing task ${task.id}:`, error);
      errors++;
    }
  }

  return { created, updated, errors };
}

/**
 * Push engagement status and metrics back to ClickUp
 */
export async function pushEngagementToClickUp(recipientId: number): Promise<void> {
  const recipient = await db.query.recipients.findFirst({
    where: eq(recipients.id, recipientId),
  });

  if (!recipient) return;

  const status = await computeRecipientStatus(recipientId);
  const statusOptionId = ENGAGEMENT_STATUS_OPTIONS[status];

  if (statusOptionId) {
    await setCustomField(recipient.clickup_task_id, FIELD_IDS.engagementStatus, statusOptionId);
  }
}

/**
 * Push full engagement metrics to ClickUp
 */
export async function pushFullMetricsToClickUp(
  recipientId: number,
  metrics: {
    status: string;
    videoProgress?: number;
    pageVisits?: number;
    lastActivity?: Date;
  }
): Promise<void> {
  const recipient = await db.query.recipients.findFirst({
    where: eq(recipients.id, recipientId),
  });

  if (!recipient) return;

  const taskId = recipient.clickup_task_id;

  // Push engagement status
  const statusOptionId = ENGAGEMENT_STATUS_OPTIONS[metrics.status];
  if (statusOptionId) {
    await setCustomField(taskId, FIELD_IDS.engagementStatus, statusOptionId);
  }

  // Push video progress
  if (metrics.videoProgress !== undefined) {
    await setCustomField(taskId, FIELD_IDS.videoProgress, metrics.videoProgress);
  }

  // Push page visits
  if (metrics.pageVisits !== undefined) {
    await setCustomField(taskId, FIELD_IDS.pageVisits, metrics.pageVisits);
  }

  // Push last activity (as Unix milliseconds for ClickUp date fields)
  if (metrics.lastActivity) {
    await setCustomField(taskId, FIELD_IDS.lastActivity, metrics.lastActivity.getTime());
  }
}

/**
 * Mark letter as sent in ClickUp
 */
export async function markLetterSent(recipientId: number): Promise<void> {
  const recipient = await db.query.recipients.findFirst({
    where: eq(recipients.id, recipientId),
  });

  if (!recipient) return;

  await setCustomField(
    recipient.clickup_task_id,
    FIELD_IDS.letterSent,
    Date.now()
  );
}

// Export field IDs and option maps for use in other modules
export { FIELD_IDS, ENGAGEMENT_STATUS_OPTIONS, ANREDE_OPTIONS, SIGNAL_CATEGORY_OPTIONS, INDUSTRY_OPTIONS };
