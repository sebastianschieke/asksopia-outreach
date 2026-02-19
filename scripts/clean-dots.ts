import { db, recipients } from '../src/lib/db';
import { sql, isNotNull } from 'drizzle-orm';

async function cleanDots() {
  const rows = await db
    .select({ id: recipients.id, val: recipients.signal_description_de })
    .from(recipients)
    .where(isNotNull(recipients.signal_description_de));

  let fixed = 0;
  for (const row of rows) {
    if (!row.val) continue;
    const cleaned = row.val
      .replace(/^Das Unternehmen wächst[\s,]*/i, '')
      .replace(/^Das Unternehmen verändert sich[\s,]*/i, '')
      .replace(/\.+$/, '')
      .trim();
    if (cleaned !== row.val) {
      await db.execute(
        sql`UPDATE recipients SET signal_description_de = ${cleaned} WHERE id = ${row.id}`
      );
      console.log(`Fixed id=${row.id}: "${row.val}" → "${cleaned}"`);
      fixed++;
    }
  }

  console.log(`Done. Fixed ${fixed} rows.`);
}

cleanDots()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
