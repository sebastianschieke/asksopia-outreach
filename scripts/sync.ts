import { syncFromClickUp } from '../src/lib/clickup';

const listId = process.env.CLICKUP_LIST_ID;
if (!listId) throw new Error('CLICKUP_LIST_ID not set');

syncFromClickUp(listId)
  .then(r => console.log('Done:', JSON.stringify(r)))
  .catch(e => { console.error(e.message); process.exit(1); });
