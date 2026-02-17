# askSOPia Outreach - Architecture & Design

## System Overview

This is a Next.js 14 application for managing personalized landing pages that sync with ClickUp tasks. The system tracks engagement events and computes engagement status based on user interactions.

```
ClickUp Tasks
    ↓
[Sync API] → Database
    ↓
Landing Pages ← [Recipients]
    ↓
Event Tracking → Database → [Status Computation] → ClickUp
```

## Core Components

### 1. Database Layer (`src/lib/db/`)

#### Schema (`schema.ts`)

Four main tables:

**recipients**
- Stores recipient info cached from ClickUp
- Primary key: `id`
- Unique constraints: `clickup_task_id`, `token`
- Indexed: `token`, `email`, `created_at`

**events**
- Tracks all landing page events
- Links to recipients via `recipient_id`
- Event types: page_view, video_start/25/50/75/complete, cta_click
- Indexed: `recipient_id`, `session_id`, `event_type`, `created_at`

**letter_templates**
- Email templates with industry targeting
- Supports Vimeo video integration
- HTML body with placeholder support

**landing_page_templates**
- Web templates with industry targeting
- Headline, subheadline, CTA button text
- HTML body with placeholder support

#### Connection (`index.ts`)

- Uses Neon serverless via `@neondatabase/serverless`
- Neon HTTP client is compatible with Vercel Edge Runtime
- Drizzle ORM handles query building and type safety

### 2. Type System (`src/lib/types.ts`)

Complete TypeScript interfaces for:
- `Recipient`: Full recipient data
- `Event`: Tracking event
- `LetterTemplate` / `LandingPageTemplate`: Template data
- `RecipientSummary`: Recipient with computed engagement status
- `EventInput`: Zod-validated event input

### 3. Token Generation (`src/lib/tokens.ts`)

Deterministic token generation:
1. Try company name (slugified)
2. Fall back to first + last name
3. Fall back to random string

Example: "Acme Corp" → "acme-corp"

German special characters handled: ä→ae, ö→oe, ü→ue, ß→ss

### 4. Engagement Tracking (`src/lib/tracking.ts`)

Status computation algorithm (from Asset-Manager):

```
NO_INTEREST: lastCTA === 'no_interest'
HOT: One of:
  - lastCTA === 'book'
  - videoWatched >= 75%
  - lastCTA === 'email' && videoWatched >= 25%
  - visits >= 2 && videoWatched >= 50%
WARM: One of:
  - videoWatched >= 50%
  - videoStarted
  - lastCTA === 'email'
COLD: Default
```

Metrics tracked:
- `page_visits`: Total page views
- `max_video_percent`: Maximum video progress
- `last_cta`: Last CTA action ('book', 'email', 'no_interest')
- `last_activity`: Timestamp of most recent event
- `video_started`: Boolean
- `repeat_visits`: Unique sessions

### 5. ClickUp Integration (`src/lib/clickup.ts`)

**Data Flow:**

1. **getTasksFromList**: Fetch tasks from ClickUp list
2. **parseTaskToRecipient**: Extract recipient info from task name and custom fields
3. **syncFromClickUp**: Upsert recipients to database
4. **pushEngagementToClickUp**: Write status back to ClickUp

**Task Name Format:**
```
"FirstName LastName — Company (City)"
```

Parsed into:
- firstName, lastName
- company
- city

**Custom Field Mapping:**
Environment variables map to ClickUp field IDs:
```
CLICKUP_FIELD_EMAIL
CLICKUP_FIELD_LINKEDIN_URL
CLICKUP_FIELD_SIGNAL_CATEGORY
CLICKUP_FIELD_SIGNAL_DESCRIPTION
etc.
```

### 6. AI Integration (`src/lib/claude.ts`)

Uses Anthropic Claude API:
- `generatePersonalizedIntro()`: Creates 2-3 sentence German business letter opening
- Input: signal category/description
- Output: Personalized paragraph connecting signal to askSOPia's value

### 7. Admin Utilities (`src/lib/admin.ts`)

Database operations for manual maintenance:
- Search, create, update, delete recipients
- Template management
- Event clearing
- Statistics

Not exposed via API - for development/admin use only.

## API Routes

### POST `/api/event`

**Track landing page events**

Input validation with Zod schema.

Workflow:
1. Validate event payload
2. Look up recipient by token
3. Insert event to database
4. If CTA event: compute status and push to ClickUp

Response:
```json
{ "success": true }
```

### POST `/api/sync`

**Sync recipients from ClickUp**

Password-protected with Authorization header.

Workflow:
1. Validate auth header
2. Fetch tasks from ClickUp list
3. For each task:
   - Parse to recipient data
   - Upsert to database
   - Generate token if new
   - Update ClickUp with token
4. Return summary

Response:
```json
{
  "success": true,
  "created": 5,
  "updated": 3
}
```

### GET `/api/landing/[token]`

**Fetch landing page data**

Workflow:
1. Look up recipient by token
2. Fetch landing template by industry
3. Fall back to default template
4. Return data

Response:
```json
{
  "recipient": { ... },
  "vimeoVideoId": "123456789",
  "bookingUrl": "https://calendly.com/...",
  "landingTemplate": { ... }
}
```

## UI Components

### Landing Page (`src/app/r/[token]/`)

**page.tsx** (Server Component)
- Fetches recipient and template data
- Passes to client component
- Handles 404 if not found

**landing-client.tsx** (Client Component)
- Renders personalized content
- Integrates Vimeo player with event tracking
- Handles CTA buttons (book, email, no interest)
- Placeholder substitution: {{first_name}}, {{last_name}}, {{company}}, {{anrede}}

**Design System:**
- Navy: #1a1a2e
- Blue: #3b82f6
- Background: #f8f8fa
- Uses Tailwind CSS

**Vimeo Integration:**
- Loads Vimeo Player SDK dynamically
- Tracks: play, timeupdate, ended
- Computes quartiles (25%, 50%, 75%, 100%)
- Sends events to `/api/event`

**Session Tracking:**
- Generates unique session ID from localStorage
- Persists across page views
- Used to compute repeat_visits

## Data Flow Examples

### New Recipient Sync

1. User added to ClickUp list as "John Doe — Acme Corp (Berlin)"
2. Admin calls POST `/api/sync` with auth header
3. System fetches task from ClickUp
4. Parses: firstName=John, lastName=Doe, company=Acme Corp, city=Berlin
5. Generates token: "acme-corp"
6. Inserts recipient to database
7. Updates ClickUp task with CLICKUP_FIELD_LANDING_TOKEN = "acme-corp"
8. Admin can now share link: https://domain.com/r/acme-corp

### Engagement Event

1. User visits landing page at `/r/acme-corp`
2. Client sends POST `/api/event` with:
   ```json
   {
     "token": "acme-corp",
     "event_type": "page_view",
     "session_id": "abc123..."
   }
   ```
3. Server looks up recipient by token
4. Inserts event to database
5. Later: user watches 60% of video
6. Client sends event with event_type="video_50", percent=0.6
7. Server inserts event
8. User clicks "Book Call"
9. Client sends event with event_type="cta_click", event_value="book"
10. Server inserts event
11. System computes status: maxVideoPercent >= 75% OR lastCTA === "book" → HOT
12. System calls pushEngagementToClickUp to update ClickUp task
13. ClickUp task now shows ENGAGEMENT_STATUS = "hot"

### Template Rendering

1. User at `/r/acme-corp`
2. Server fetches recipient (industry="Fintech")
3. Server queries landing_page_templates WHERE industry="Fintech"
4. If found: use industry template
5. If not found: use default template (is_default=true)
6. Client receives template with placeholders:
   ```html
   <h1>Hallo {{first_name}}, Acme Corp wird durch askSOPia...</h1>
   ```
7. Client replaces placeholders:
   ```html
   <h1>Hallo John, Acme Corp wird durch askSOPia...</h1>
   ```

## Database Query Patterns

### Compute Status for Single Recipient

```typescript
const events = await db.select().from(events)
  .where(eq(events.recipient_id, recipientId));

// Filter by event type
const videoEvents = events.filter(e => e.event_type.startsWith('video_'));
const ctaEvents = events.filter(e => e.event_type === 'cta_click');

// Compute metrics
const maxVideoPercent = Math.max(...videoEvents.map(e => e.percent ?? 0));
const lastCta = ctaEvents[ctaEvents.length - 1]?.event_value;

// Determine status
let status: EngagementStatus = 'cold';
if (lastCta === 'no_interest') {
  status = 'no_interest';
} else if (lastCta === 'book' || maxVideoPercent >= 0.75) {
  status = 'hot';
} else if (maxVideoPercent >= 0.50) {
  status = 'warm';
}
```

### Filter Recipients by Status

```typescript
// After computing summaries for all recipients
const hotRecipients = summaries.filter(s => s.status === 'hot');
const warmRecipients = summaries.filter(s => s.status === 'warm');
```

### Fetch Template with Fallback

```typescript
// Try industry-specific
let template = await db.query.landingPageTemplates.findFirst({
  where: eq(landingPageTemplates.industry, recipient.industry)
});

// Fall back to default
if (!template) {
  template = await db.query.landingPageTemplates.findFirst({
    where: eq(landingPageTemplates.is_default, true)
  });
}
```

## Security Considerations

### Authentication

- **Sync Endpoint**: Bearer token in Authorization header
- **Event Tracking**: Token lookup (no auth needed - token is semi-public)
- **Admin Operations**: Not exposed via API

### Data Privacy

- Events are scoped to recipient_id
- Session IDs are client-generated, no PII
- User agent captured for analytics only
- No passwords or sensitive data stored

### Rate Limiting

- ClickUp API: 100 requests/minute (built-in)
- Consider implementing rate limiting on `/api/event` for production

## Performance Optimizations

### Database

- Indexes on frequently queried fields: token, recipient_id, created_at
- Neon serverless handles scaling automatically
- Connection pooling built into Neon

### Queries

- Drizzle ORM generates efficient SQL
- Use `limit(1)` for single-record lookups
- Batch inserts where possible

### Caching

- Templates could be cached in-memory or Redis
- Session IDs persisted to localStorage (client-side)

### Edge Cases

- Duplicate events: Same event can be logged multiple times (expected for video quartiles)
- Session consistency: Events from same session maintain order by created_at
- Concurrent updates: Database handles concurrency naturally

## Testing Recommendations

1. **Unit Tests**
   - Token generation with edge cases
   - Status computation logic
   - Placeholder substitution

2. **Integration Tests**
   - Full sync flow: ClickUp → DB → Landing page
   - Event tracking: Client → API → DB → Status computation
   - Template rendering with placeholders

3. **E2E Tests**
   - User flow: Access landing → Watch video → Click CTA → Check status in ClickUp

4. **Load Tests**
   - Event tracking under load
   - Multiple concurrent landing page visits

## Monitoring

Key metrics to track:
- Events per day / per recipient
- Status distribution (hot/warm/cold/no_interest)
- Video completion rate
- CTA click rate by type
- Sync success rate
- API error rates

Consider: DataDog, New Relic, or similar for production monitoring.

## Future Enhancements

1. **A/B Testing**: Multiple templates per industry
2. **Analytics Dashboard**: Cohort analysis, funnel visualization
3. **Automated Workflows**: Trigger actions on status change
4. **Multi-language**: Template localization
5. **Email Integration**: Auto-send follow-ups based on engagement
6. **Bulk Operations**: Import from CSV, batch updates
7. **Webhooks**: Push events to external systems
8. **Advanced Personalization**: Dynamic content based on signals
