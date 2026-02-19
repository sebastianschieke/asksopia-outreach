import { db, recipients, events } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { syncFromClickUp } from '../src/lib/clickup';

const listId = process.env.CLICKUP_LIST_ID;
if (!listId) throw new Error('CLICKUP_LIST_ID not set');

async function run() {
  // 1. Clear events first (references recipients)
  await db.delete(events);
  console.log('Cleared events table');

  // 2. Clear recipients
  await db.delete(recipients);
  console.log('Cleared recipients table');

  // Reset serial sequences so IDs start from 1 again
  await db.execute(sql`ALTER SEQUENCE recipients_id_seq RESTART WITH 1`);
  await db.execute(sql`ALTER SEQUENCE events_id_seq RESTART WITH 1`);
  console.log('Reset ID sequences');

  // 3. Re-sync from ClickUp (translates signal_description_de via Claude)
  console.log('Syncing from ClickUp…');
  const result = await syncFromClickUp(listId);
  console.log('Done:', JSON.stringify(result));
}

run().catch(e => { console.error(e.message); process.exit(1); });
