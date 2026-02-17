# askSOPia Outreach - API Reference

Complete reference for all functions, types, and endpoints.

## Database Functions

### `src/lib/db/index.ts`

```typescript
import { db } from '@/lib/db';

// Use db to perform Drizzle ORM queries
const recipients = await db.select().from(recipients);
```

### `src/lib/db/migrations.ts`

```typescript
import { initializeDatabase, checkDatabaseConnection } from '@/lib/db/migrations';

// Initialize schema (optional, Drizzle handles this)
await initializeDatabase();

// Check if database is accessible
const connected = await checkDatabaseConnection();
```

## Type Definitions

### `src/lib/types.ts`

```typescript
import type {
  Recipient,
  Event,
  LetterTemplate,
  LandingPageTemplate,
  RecipientSummary,
  LandingPageData,
  EngagementStatus,
  EventType,
  ClickUpTask,
  EventInput,
} from '@/lib/types';

// Validation
import { eventSchema } from '@/lib/types';
const validated = eventSchema.parse(input);
```

## Token Generation

### `src/lib/tokens.ts`

```typescript
import { slugify, generateToken } from '@/lib/tokens';

// Slugify text
const slug = slugify('Müller GmbH'); // "mueller-gmbh"

// Generate token
const token = generateToken('Acme Corp', 'John', 'Doe'); // "acme-corp"
const token2 = generateToken(null, 'Jane', 'Smith'); // "jane-smith"
const token3 = generateToken(null, null, null); // "a1b2c3d4e5"
```

## Engagement Tracking

### `src/lib/tracking.ts`

```typescript
import {
  computeRecipientStatus,
  getRecipientSummary,
  getAllRecipientSummaries,
} from '@/lib/tracking';

// Get status for single recipient
const status = await computeRecipientStatus(recipientId);
// Returns: 'hot' | 'warm' | 'cold' | 'no_interest'

// Get complete summary with metrics
const summary = await getRecipientSummary(recipientId);
/*
{
  ...recipient,
  status: 'warm',
  page_visits: 3,
  max_video_percent: 0.65,
  last_cta: 'email',
  last_activity: '2024-02-17T10:30:00Z',
  video_started: true,
  repeat_visits: 2
}
*/

// Get all summaries
const allSummaries = await getAllRecipientSummaries();
```

## ClickUp Integration

### `src/lib/clickup.ts`

```typescript
import {
  getTasksFromList,
  updateTaskCustomFields,
  parseTaskToRecipient,
  syncFromClickUp,
  pushEngagementToClickUp,
} from '@/lib/clickup';

// Fetch tasks
const tasks = await getTasksFromList('123456789');

// Update custom fields
await updateTaskCustomFields('task-id', {
  email: 'john@example.com',
  landing_token: 'acme-corp',
});

// Parse task to recipient
const recipient = parseTaskToRecipient(task);
// Extracts: firstName, lastName, company, city, email, etc.

// Sync from ClickUp
const result = await syncFromClickUp('list-id');
// Returns: { created: 5, updated: 3 }

// Push status to ClickUp
await pushEngagementToClickUp(recipientId);
// Updates CLICKUP_FIELD_ENGAGEMENT_STATUS
```

## Claude AI

### `src/lib/claude.ts`

```typescript
import { generatePersonalizedIntro } from '@/lib/claude';

// Generate personalized intro
const intro = await generatePersonalizedIntro(
  'John',
  'Acme Corp',
  'Growth Signal',
  'Recently hired VP of Sales'
);
/*
Returns German text like:
"Ich bin auf die jüngste Beförderung von VP Sales bei Acme Corp aufmerksam geworden
und habe gesehen, dass Sie Ihr Sales-Team expandieren. Genau hier kann askSOPia
Ihnen helfen, die Effizienz Ihrer Beratungsprozesse zu steigern."
*/
```

## Admin Utilities

### `src/lib/admin.ts`

```typescript
import {
  getAllRecipients,
  getRecipientById,
  searchRecipients,
  getTemplateById,
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getLandingTemplateById,
  getAllLandingTemplates,
  createLandingTemplate,
  updateLandingTemplate,
  deleteLandingTemplate,
  getRecipientEvents,
  clearRecipientEvents,
  deleteRecipient,
  getStatistics,
} from '@/lib/admin';

// Recipients
const recipients = await getAllRecipients(100);
const recipient = await getRecipientById(1);
const results = await searchRecipients('john');

// Letter Templates
const templates = await getAllTemplates();
const template = await getTemplateById(1);
const id = await createTemplate({
  name: 'Default',
  body_html: '<p>Hello</p>',
  is_default: true,
});
await updateTemplate(id, { body_html: '<p>Updated</p>' });
await deleteTemplate(id);

// Landing Templates
const lpTemplates = await getAllLandingTemplates();
const lpTemplate = await getLandingTemplateById(1);
await createLandingTemplate({
  name: 'Default',
  headline: 'Welcome {{first_name}}',
  is_default: true,
});

// Events
const events = await getRecipientEvents(recipientId);
await clearRecipientEvents(recipientId);

// Deletion
await deleteRecipient(recipientId); // Cascades to events

// Stats
const stats = await getStatistics();
// { totalRecipients: 50, totalEvents: 1234, recentEvents: 456 }
```

## API Endpoints

### POST `/api/event`

Track landing page events.

**Request:**
```json
{
  "token": "acme-corp",
  "session_id": "abc123def456",
  "event_type": "page_view",
  "event_value": null,
  "percent": null,
  "url_path": "/r/acme-corp",
  "referrer": "google.com",
  "user_agent": "Mozilla/5.0..."
}
```

**Event Types:**
- `page_view`: User visited landing page
- `video_start`: User pressed play on video
- `video_25`: Video watched to 25%
- `video_50`: Video watched to 50%
- `video_75`: Video watched to 75%
- `video_complete`: Video completed
- `cta_click`: User clicked CTA button
  - `event_value`: 'book', 'email', 'no_interest'

**Response:**
```json
{ "success": true }
```

**Error Responses:**
```json
{ "error": "Recipient not found" }           // 404
{ "error": "Invalid request" }               // 400
{ "error": "Internal server error" }         // 500
```

### POST `/api/sync`

Sync recipients from ClickUp list.

**Request:**
```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer your-password"
```

**Response:**
```json
{
  "success": true,
  "created": 5,
  "updated": 3,
  "message": "Synced 8 recipients (5 new, 3 updated)"
}
```

**Error Responses:**
```json
{ "error": "Unauthorized" }                  // 401
{ "error": "CLICKUP_LIST_ID not configured" } // 500
{ "error": "Internal server error" }         // 500
```

### GET `/api/landing/[token]`

Fetch landing page data for a recipient.

**Request:**
```bash
curl http://localhost:3000/api/landing/acme-corp
```

**Response:**
```json
{
  "recipient": {
    "id": 1,
    "token": "acme-corp",
    "first_name": "John",
    "last_name": "Doe",
    "company": "Acme Corp",
    "email": "john@acme.com",
    ...
  },
  "vimeoVideoId": "123456789",
  "bookingUrl": "https://calendly.com/...",
  "landingTemplate": {
    "id": 1,
    "name": "Default",
    "headline": "Hallo {{first_name}}",
    ...
  }
}
```

**Error Responses:**
```json
{ "error": "Recipient not found" }           // 404
{ "error": "Internal server error" }         // 500
```

## Database Schema

### Recipients Table

```typescript
interface Recipient {
  id: number;
  clickup_task_id: string;        // Unique
  token: string;                  // Unique
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  industry: string | null;
  linkedin_url: string | null;
  booking_url: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  anrede: string | null;
  signal_category: string | null;
  signal_description: string | null;
  letter_generated_at: Date | null;
  letter_sent_at: Date | null;
  letter_version: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### Events Table

```typescript
interface Event {
  id: number;
  recipient_id: number;
  session_id: string;
  event_type: 'page_view' | 'video_start' | 'video_25' | 'video_50' | 'video_75' | 'video_complete' | 'cta_click';
  event_value: string | null;     // 'book', 'email', 'no_interest'
  percent: number | null;         // 0.0 - 1.0
  url_path: string | null;
  referrer: string | null;
  user_agent: string | null;
  created_at: Date;
}
```

### Letter Templates Table

```typescript
interface LetterTemplate {
  id: number;
  name: string;
  industry: string | null;
  subject_line: string | null;
  body_html: string;
  vimeo_video_id: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}
```

### Landing Page Templates Table

```typescript
interface LandingPageTemplate {
  id: number;
  name: string;
  industry: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_button_text: string | null;
  body_html: string | null;
  vimeo_video_id: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}
```

## Placeholder Substitution

Landing templates support dynamic content:

```html
<h1>Hallo {{first_name}}</h1>
<p>Spezialisiert für {{company}}</p>
<p>{{anrede}}</p>
```

**Available Placeholders:**
- `{{first_name}}` - Recipient's first name
- `{{last_name}}` - Recipient's last name
- `{{company}}` - Company name
- `{{anrede}}` - German formal greeting

**Example:**

For recipient: `{ first_name: "John", last_name: "Doe", company: "Acme", anrede: "Herr Doe" }`

```html
Hallo John
Spezialisiert für Acme
Sehr geehrter Herr Doe
```

## Environment Variables

See `.env.example` for complete list.

**Required:**
```env
DATABASE_URL=postgresql://...
CLICKUP_API_KEY=pk_...
CLICKUP_LIST_ID=...
ANTHROPIC_API_KEY=sk-ant-...
SYNC_PASSWORD=...
```

**Optional:**
```env
NEXT_PUBLIC_BOOKING_URL=https://calendly.com/...
CLICKUP_FIELD_*=field-id
```

## Error Handling

All endpoints follow this pattern:

```typescript
try {
  // Validation
  const data = schema.parse(input);

  // Business logic
  const result = await db.query(...);

  // Success response
  return NextResponse.json({ success: true, data: result });
} catch (error) {
  console.error('Error:', error);

  // Error response
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

## Rate Limiting

No rate limiting implemented by default. For production, consider:

1. **Built-in ClickUp limits:** 100 requests/minute
2. **Add Vercel Rate Limit middleware:**
   ```typescript
   import { rateLimit } from '@vercel/rate-limit';

   const limiter = rateLimit({
     interval: 60 * 1000, // 1 minute
     tokensPerInterval: 100,
   });
   ```

## Testing

### Unit Tests

```typescript
// Test token generation
expect(generateToken('Acme', 'John', 'Doe')).toBe('acme');
expect(generateToken(null, 'John', 'Doe')).toBe('john-doe');

// Test status computation
const status = await computeRecipientStatus(recipientId);
expect(['hot', 'warm', 'cold', 'no_interest']).toContain(status);
```

### Integration Tests

```typescript
// Test sync flow
const result = await syncFromClickUp(listId);
expect(result.created).toBeGreaterThanOrEqual(0);

// Test event tracking
const response = await fetch('/api/event', {
  method: 'POST',
  body: JSON.stringify(eventPayload),
});
expect(response.ok).toBe(true);
```

### E2E Tests

```typescript
// Full user journey
1. Fetch landing page
2. Verify content loaded
3. Watch video
4. Track events
5. Click CTA
6. Verify status updated
```

## Performance Tips

1. **Batch operations:** Sync multiple recipients at once
2. **Caching:** Templates don't change frequently - consider caching
3. **Indexes:** Already applied to frequently queried columns
4. **Pagination:** Use `limit()` and `offset()` for large result sets
5. **CDN:** Vimeo videos cached by CDN, not your server

## Troubleshooting

**Event not tracking:**
- Check network tab for `/api/event` requests
- Verify token in request matches database
- Check browser console for JavaScript errors

**Recipient not found:**
- Verify recipient was synced: `SELECT * FROM recipients WHERE token = 'xxx'`
- Check token in URL matches database exactly

**ClickUp sync fails:**
- Verify `CLICKUP_API_KEY` is valid
- Check `CLICKUP_LIST_ID` is correct format
- Test with: `curl https://api.clickup.com/api/v2/list/[ID]/task`

**Status not updating:**
- Check engagement events were recorded
- Verify status computation logic with manual calculation
- Ensure ClickUp field ID is correct

## Support & Resources

- Drizzle ORM: https://orm.drizzle.team/docs
- Neon: https://neon.tech/docs
- ClickUp API: https://clickup.com/api/
- Anthropic Claude: https://console.anthropic.com/docs
- Next.js: https://nextjs.org/docs

## Version Information

- Node.js: 18+
- Next.js: 16.1.6
- Drizzle ORM: 0.45.1
- PostgreSQL: 12+
- TypeScript: 5.0+
