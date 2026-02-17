# askSOPia Outreach - Quick Start Guide

Get up and running in 10 minutes.

## 1. Clone & Install

```bash
git clone <repo-url>
cd asksopia-outreach
npm install
```

## 2. Setup Database

### Option A: Neon (Recommended for Vercel)

1. Create account at https://console.neon.tech/
2. Create new database
3. Copy connection string

### Option B: Local PostgreSQL

```bash
createdb asksopia_outreach
export DATABASE_URL="postgresql://user:password@localhost:5432/asksopia_outreach"
```

## 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Database
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]

# ClickUp (get from ClickUp workspace settings)
CLICKUP_API_KEY=pk_2589...
CLICKUP_LIST_ID=900123456789

# Anthropic
ANTHROPIC_API_KEY=sk-ant-v0...

# Admin
SYNC_PASSWORD=your-secure-password

# Booking (Calendly)
NEXT_PUBLIC_BOOKING_URL=https://calendly.com/your-link
```

## 4. Setup Database Schema

```bash
# Push Drizzle schema to database
npm run drizzle:push
```

If using SQL directly:
```bash
psql $DATABASE_URL < sql/schema.sql
```

## 5. Configure ClickUp Custom Fields

1. Open your ClickUp list
2. Click task → see custom fields
3. Note each field ID

3. Update `.env.local` with field IDs:
```env
CLICKUP_FIELD_EMAIL=3a4b5c6d
CLICKUP_FIELD_LINKEDIN_URL=7e8f9g0h
CLICKUP_FIELD_SIGNAL_CATEGORY=1i2j3k4l
CLICKUP_FIELD_SIGNAL_DESCRIPTION=5m6n7o8p
CLICKUP_FIELD_ADDRESS=9q0r1s2t
CLICKUP_FIELD_CITY=3u4v5w6x
CLICKUP_FIELD_POSTAL_CODE=7y8z9a0b
CLICKUP_FIELD_LANDING_TOKEN=1c2d3e4f
CLICKUP_FIELD_ENGAGEMENT_STATUS=5g6h7i8j
```

## 6. Create Landing Page Template

```bash
npm run dev
```

Visit http://localhost:3000 (will show 404 - that's OK, we need to set up templates first).

In another terminal, create a template using Node:

```bash
node -e "
const db = require('drizzle-orm/neon-http');
const schema = require('./src/lib/db/schema');

(async () => {
  const client = db.drizzle(require('@neondatabase/serverless').neon(process.env.DATABASE_URL), { schema });

  await client.insert(schema.landingPageTemplates).values({
    name: 'Default',
    industry: null,
    headline: 'Hallo {{first_name}}',
    subheadline: 'Entdecken Sie, wie askSOPia.com Ihre Beratung effizienter macht.',
    cta_button_text: 'Termin vereinbaren',
    body_html: '<p>Spezialisiert für {{company}}.</p>',
    vimeo_video_id: '123456789', // Replace with actual video ID
    is_default: true,
  });

  console.log('Template created');
  process.exit(0);
})();
" DATABASE_URL=$DATABASE_URL
```

Or use Drizzle Studio:
```bash
npm run drizzle:studio
# Open browser to http://localhost:3000
# Insert record into landing_page_templates table
```

## 7. Sync Recipients from ClickUp

Add a test task to your ClickUp list with format:
```
John Doe — Acme Corp (Berlin)
```

Then sync:
```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer your-secure-password" \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "created": 1,
  "updated": 0,
  "message": "Synced 1 recipients (1 new, 0 updated)"
}
```

## 8. Test Landing Page

After sync, the recipient gets a token (e.g., "acme-corp").

Visit:
```
http://localhost:3000/r/acme-corp
```

You should see:
- Personalized greeting
- Company name
- Video player
- CTA buttons
- Footer

## 9. Test Event Tracking

Open browser console and watch:
```bash
curl http://localhost:3000/r/acme-corp
```

Network tab should show POST `/api/event` with page_view event.

Click buttons, watch video progress - all should be tracked.

## 10. Deploy to Vercel

```bash
git push origin main
```

Vercel auto-deploys. Set environment variables in Vercel project settings.

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run ESLint

# Database
npm run drizzle:generate # Generate migrations
npm run drizzle:push     # Apply migrations
npm run drizzle:studio   # Open web UI

# Production
npm run build            # Build for production
npm start                # Start production server
```

## Common Issues

### "Recipient not found"
- Landing page returns 404
- Check recipient was synced: `SELECT * FROM recipients WHERE token = 'xxx';`
- Check token in URL matches database

### "Database connection error"
- Verify `DATABASE_URL` is correct
- For Neon: check network access (allow Vercel IPs if needed)
- Test: `psql $DATABASE_URL -c "SELECT 1"`

### "ClickUp sync fails"
- Verify `CLICKUP_API_KEY` is valid
- Check `CLICKUP_LIST_ID` is correct
- Verify custom field IDs match your list
- Check task name format: "FirstName LastName — Company (City)"

### "Events not tracking"
- Check `/api/event` endpoint is accessible
- Open browser console for JavaScript errors
- Verify token in request matches database

## Next Steps

1. Add more templates for different industries
2. Customize landing page copy and design
3. Set up monitoring (Vercel Analytics, Posthog, etc.)
4. Create admin dashboard to view recipients and status
5. Set up email notifications for hot leads
6. Configure webhooks to external CRM/tools

## Support

- Drizzle ORM docs: https://orm.drizzle.team/
- Neon docs: https://neon.tech/docs/
- ClickUp API: https://clickup.com/api/
- Anthropic Claude: https://console.anthropic.com/docs/
- Next.js: https://nextjs.org/docs/

Happy outreach! 🚀
