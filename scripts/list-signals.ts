import { db, recipients } from '../src/lib/db';
import { isNotNull } from 'drizzle-orm';

async function list() {
  const rows = await db
    .select({ company: recipients.company, cat: recipients.signal_category, de: recipients.signal_description_de })
    .from(recipients)
    .where(isNotNull(recipients.signal_description_de));
  for (const r of rows) {
    console.log((r.cat ?? '').padEnd(18), (r.company ?? '').padEnd(35), r.de);
  }
  console.log(`\nTotal: ${rows.length}`);
}

list()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
