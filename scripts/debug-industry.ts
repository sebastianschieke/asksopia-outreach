import { db, recipients } from '../src/lib/db';
import { isNull } from 'drizzle-orm';
import { getTasksFromList } from '../src/lib/clickup';

const INDUSTRY_FIELD_ID = '51ab00b5-daa0-4be3-a497-75d2564df235';
const listId = process.env.CLICKUP_LIST_ID;
if (!listId) throw new Error('CLICKUP_LIST_ID not set');

async function run() {
  // Get clickup_task_ids for recipients with null industry
  const missing = await db
    .select({ clickup_task_id: recipients.clickup_task_id, company: recipients.company })
    .from(recipients)
    .where(isNull(recipients.industry));

  console.log(`${missing.length} recipients missing industry. Fetching tasks from ClickUp...`);

  const tasks = await getTasksFromList(listId!);

  for (const m of missing.slice(0, 3)) { // check first 3 only
    const task = tasks.find(t => t.id === m.clickup_task_id);
    if (!task) { console.log(`${m.company}: task not found in ClickUp`); continue; }

    const field = task.custom_fields?.find(f => f.id === INDUSTRY_FIELD_ID);
    if (!field) {
      console.log(`${m.company}: industry field NOT present on task`);
    } else {
      console.log(`${m.company}: field type="${field.type}" value=${JSON.stringify(field.value)} type_config_options=${JSON.stringify(field.type_config?.options?.slice(0,2))}`);
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
