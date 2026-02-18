# askSOPia Outreach - Setup Guide

## Overview

This is a Next.js application for managing personalized landing pages and tracking engagement from ClickUp tasks.

## Prerequisites

- Node.js 18+
- qerweqr
- PostgreSQL database (Neon recommended for Vercel integration)
- ClickUp workspace with API access
- Anthropic API key
- Vercel account (for deployment)

## Setup Steps

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables needed:
- `DATABASE_URL`: PostgreSQL connection string
- `CLICKUP_API_KEY`: Your ClickUp API token
- `CLICKUP_LIST_ID`: ID of the ClickUp list to sync from
- `ANTHROPIC_API_KEY`: Claude API key
- `SYNC_PASSWORD`: Password for admin sync endpoint

### 2. Database Setup

#### Using Neon (Recommended)

1. Create a Neon database at https://console.neon.tech/
2. Copy the connection string to `DATABASE_URL` in `.env.local`

#### Running Migrations

```bash
# Generate SQL migrations from Drizzle schema
npm run drizzle:generate

# Push schema to database
npm run drizzle:push
```

Or manually create tables using the schema in `src/lib/db/schema.ts`.

### 3. ClickUp Configuration

1. Get your ClickUp API key from Settings > Integrations
2. Find your list ID from the ClickUp URL: `https://app.clickup.com/[workspace]/lists/[list-id]`

#### Configure Custom Fields

Get the custom field IDs from your ClickUp list:

1. Open a task in your list
2. Inspect the custom fields API by viewing task details
3. Map each field ID to the corresponding env var:
   - `CLICKUP_FIELD_EMAIL`
   - `CLICKUP_FIELD_LINKEDIN_URL`
   - `CLICKUP_FIELD_SIGNAL_CATEGORY`
   - `CLICKUP_FIELD_SIGNAL_DESCRIPTION`
   - `CLICKUP_FIELD_ADDRESS`
   - `CLICKUP_FIELD_CITY`
   - `CLICKUP_FIELD_POSTAL_CODE`
   - `CLICKUP_FIELD_LANDING_TOKEN`
   - `CLICKUP_FIELD_ENGAGEMENT_STATUS`

### 4. Install Dependencies

```bash
npm install
```

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## API Endpoints

### POST `/api/event`

Track landing page events (page views, video engagement, CTA clicks).

Request:
```json
{
  "token": "recipient-token",
  "session_id": "session-id",
  "event_type": "page_view",
  "event_value": null,
  "percent": null,
  "url_path": "/r/some-token",
  "referrer": "google.com",
  "user_agent": "Mozilla/5.0..."
}
```

### POST `/api/sync`

Sync recipients from ClickUp list.

Header: `Authorization: Bearer {SYNC_PASSWORD}`

Response:
```json
{
  "success": true,
  "created": 5,
  "updated": 3,
  "message": "Synced 8 recipients (5 new, 3 updated)"
}
```

### GET `/api/landing/[token]`

Fetch landing page data for a recipient.

Response:
```json
{
  "recipient": { ... },
  "vimeoVideoId": "123456789",
  "bookingUrl": "https://calendly.com/...",
  "landingTemplate": { ... }
}
```

## Landing Pages

Recipients can access their personalized landing page at:

```
https://yourdomain.com/r/{token}
```

The token is automatically generated from the company name or full name and stored in the ClickUp task.

### Personalization

Landing pages support placeholder substitution:
- `{{first_name}}` - Recipient's first name
- `{{last_name}}` - Recipient's last name
- `{{company}}` - Company name
- `{{anrede}}` - German formal greeting

## Database Schema

### recipients
- `id`: Primary key
- `clickup_task_id`: ClickUp task ID (unique)
- `token`: Landing page token (unique)
- `first_name`, `last_name`, `company`: Recipient info
- `email`, `linkedin_url`: Contact details
- `signal_category`, `signal_description`: Why they were contacted
- `letter_*`: Letter generation tracking
- Timestamps: `created_at`, `updated_at`

### events
- Tracks all landing page events
- Links to recipients via `recipient_id`
- Captures session, event type, video progress, CTAs
- Indexed for fast queries

### letter_templates
- Email templates with industry targeting
- Vimeo video integration
- HTML body with placeholder support

### landing_page_templates
- Landing page templates with industry targeting
- Headline, subheadline, CTA button text
- HTML body with placeholder support

## Engagement Status Logic

Status is computed from event data:

- **NO_INTEREST**: User clicked "no interest" button
- **HOT**: One of:
  - User clicked "book"
  - Video watched 75%+
  - Email requested AND video watched 25%+
  - 2+ visits AND video watched 50%+
- **WARM**: One of:
  - Video watched 50%+
  - Video started
  - Email requested
- **COLD**: Default (low engagement)

Status is pushed to ClickUp via `CLICKUP_FIELD_ENGAGEMENT_STATUS` when changed.

## Deployment

### To Vercel

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel project settings
3. Deploy

```bash
git push origin main
```

### Database Considerations

- Neon serverless is fully compatible with Vercel
- Use the serverless connection string from Neon
- Migrations run automatically or via `npm run drizzle:push`

## Development

### Code Structure

```
src/
├── app/
│   ├── api/
│   │   ├── event/           # Event tracking
│   │   ├── sync/            # ClickUp sync
│   │   └── landing/[token]/ # Landing page data
│   └── r/[token]/           # Landing page UI
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Drizzle ORM schema
│   │   ├── index.ts         # Database connection
│   │   └── migrations.ts    # Migration utilities
│   ├── types.ts             # TypeScript types
│   ├── tokens.ts            # Token generation
│   ├── tracking.ts          # Engagement status logic
│   ├── clickup.ts           # ClickUp API client
│   └── claude.ts            # Anthropic API client
└── env.d.ts                 # Environment types
```

### Running Drizzle Commands

```bash
# Generate migration files from schema changes
npm run drizzle:generate

# Push schema to database
npm run drizzle:push

# Open Drizzle Studio (web UI)
npm run drizzle:studio
```

Add these scripts to `package.json`:
```json
{
  "scripts": {
    "drizzle:generate": "drizzle-kit generate",
    "drizzle:push": "drizzle-kit push",
    "drizzle:studio": "drizzle-kit studio"
  }
}
```

## Troubleshooting

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Check network access (allow Vercel IPs for Neon)
- Test connection: `psql $DATABASE_URL`

### ClickUp Sync Issues

- Verify `CLICKUP_API_KEY` is valid
- Check `CLICKUP_LIST_ID` is correct
- Ensure custom field IDs match your list
- Check ClickUp rate limits (100 requests/minute)

### Event Tracking Not Working

- Verify recipient token exists in database
- Check browser console for fetch errors
- Ensure `/api/event` endpoint is accessible

### Landing Page Not Found

- Verify token in URL matches database
- Check `DATABASE_URL` is correct
- Ensure recipient was synced from ClickUp

## Next Steps

1. Set up landing page templates in database
2. Configure Vimeo videos
3. Set up Calendly booking link
4. Test full flow: ClickUp → Sync → Landing → Tracking
5. Deploy to Vercel
