import { db, recipients } from './db';
import { eq } from 'drizzle-orm';
import { generateToken } from './tokens';
import { computeRecipientStatus } from './tracking';
import type { Recipient, ClickUpTask } from './types';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'dummy_key';

/**
 * Fetch all tasks from a ClickUp list
 */
export async function getTasksFromList(listId: string): Promise<ClickUpTask[]> {
  try {
    const response = await fetch(`${CLICKUP_API_URL}/list/${listId}/task?include_subtasks=false&limit=100`, {
      headers: {
        Authorization: CLICKUP_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { tasks?: ClickUpTask[] };
    return data.tasks || [];
  } catch (error) {
    console.error('Error fetching ClickUp tasks:', error);
    return [];
  }
}

/**
 * Update custom fields on a ClickUp task
 */
export async function updateTaskCustomFields(
  taskId: string,
  fields: Record<string, unknown>
): Promise<void> {
  try {
    const customFields: Array<{ id: string; value: unknown }> = [];

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      const fieldId = process.env[`CLICKUP_FIELD_${fieldName.toUpperCase()}`];
      if (fieldId) {
        customFields.push({ id: fieldId, value: fieldValue });
      }
    }

    if (customFields.length === 0) {
      return;
    }

    await fetch(`${CLICKUP_API_URL}/task/${taskId}`, {
      method: 'PUT',
      headers: {
        Authorization: CLICKUP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ custom_fields: customFields }),
    });
  } catch (error) {
    console.error('Error updating ClickUp task:', error);
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
 * Get custom field value by field ID
 */
function getCustomFieldValue(task: ClickUpTask, fieldId: string | undefined): unknown {
  if (!fieldId || !task.custom_fields) {
    return null;
  }
  const field = task.custom_fields.find((f) => f.id === fieldId);
  return field?.value ?? null;
}

/**
 * Convert ClickUp task to Recipient
 */
export function parseTaskToRecipient(task: ClickUpTask): Partial<Recipient> {
  const { firstName, lastName, company, city } = parseTaskName(task.name);

  // Get custom field values
  const email = getCustomFieldValue(task, process.env.CLICKUP_FIELD_EMAIL) as string | null;
  const linkedinUrl = getCustomFieldValue(task, process.env.CLICKUP_FIELD_LINKEDIN_URL) as string | null;
  const signalCategory = getCustomFieldValue(task, process.env.CLICKUP_FIELD_SIGNAL_CATEGORY) as string | null;
  const signalDescription = getCustomFieldValue(task, process.env.CLICKUP_FIELD_SIGNAL_DESCRIPTION) as string | null;
  const address = getCustomFieldValue(task, process.env.CLICKUP_FIELD_ADDRESS) as string | null;
  const postalCode = getCustomFieldValue(task, process.env.CLICKUP_FIELD_POSTAL_CODE) as string | null;

  // Generate token if needed
  const existingToken = getCustomFieldValue(task, process.env.CLICKUP_FIELD_LANDING_TOKEN) as string | null;
  const token = existingToken || generateToken(company, firstName, lastName);

  return {
    clickup_task_id: task.id,
    token,
    first_name: firstName,
    last_name: lastName,
    company,
    email,
    city,
    street: address,
    postal_code: postalCode,
    linkedin_url: linkedinUrl,
    signal_category: signalCategory,
    signal_description: signalDescription,
  };
}

/**
 * Sync all tasks from ClickUp list to database
 */
export async function syncFromClickUp(listId: string): Promise<{ created: number; updated: number }> {
  const tasks = await getTasksFromList(listId);
  let created = 0;
  let updated = 0;

  for (const task of tasks) {
    try {
      const recipientData = parseTaskToRecipient(task);

      // Check if recipient exists
      const existing = await db
        .select()
        .from(recipients)
        .where(eq(recipients.clickup_task_id, task.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        const { created_at, updated_at, ...dataWithoutDates } = recipientData as any;
        await db
          .update(recipients)
          .set({
            ...dataWithoutDates,
            updated_at: new Date(),
          } as any)
          .where(eq(recipients.clickup_task_id, task.id));
        updated++;
      } else {
        // Insert new
        const { created_at, updated_at, ...dataWithoutDates } = recipientData as any;
        await db.insert(recipients).values({
          ...dataWithoutDates,
          created_at: new Date(),
          updated_at: new Date(),
        } as any);
        created++;

        // Update ClickUp task with generated token
        if (recipientData.token) {
          const tokenFieldId = process.env.CLICKUP_FIELD_LANDING_TOKEN;
          if (tokenFieldId) {
            await updateTaskCustomFields(task.id, {
              landing_token: recipientData.token,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error syncing task ${task.id}:`, error);
    }
  }

  return { created, updated };
}

/**
 * Push engagement status and metrics to ClickUp
 */
export async function pushEngagementToClickUp(recipientId: number): Promise<void> {
  const recipient = await db.query.recipients.findFirst({
    where: eq(recipients.id, recipientId),
  });

  if (!recipient) {
    return;
  }

  const status = await computeRecipientStatus(recipientId);

  const updates: Record<string, unknown> = {
    engagement_status: status,
  };

  await updateTaskCustomFields(recipient.clickup_task_id, updates);
}
