import { db, landingPageTemplates, letterTemplates } from '../src/lib/db';

async function list() {
  const lp = await db.select().from(landingPageTemplates);
  console.log('\n=== Landing Page Templates ===');
  for (const t of lp) {
    console.log(`id=${t.id} name="${t.name}" industry="${t.industry}" vimeo="${t.vimeo_video_id}" default=${t.is_default}`);
  }

  const lt = await db.select().from(letterTemplates);
  console.log('\n=== Letter Templates ===');
  for (const t of lt) {
    console.log(`id=${t.id} name="${t.name}" industry="${t.industry}" vimeo="${t.vimeo_video_id}" default=${t.is_default}`);
  }
}

list()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
