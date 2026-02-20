import { db, recipients } from '../src/lib/db';

async function run() {
  const all = await db.select({ id: recipients.id, company: recipients.company, industry: recipients.industry }).from(recipients);
  const missing = all.filter(r => r.industry === null || r.industry === undefined);
  console.log(`Total: ${all.length}  |  Missing industry: ${missing.length}`);
  console.log('\nAll:');
  for (const r of all) {
    console.log((r.industry ?? 'NULL').padEnd(32), r.company);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
