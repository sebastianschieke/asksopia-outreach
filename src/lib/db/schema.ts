import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  real,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Recipients table - cached from ClickUp tasks
 */
export const recipients = pgTable(
  'recipients',
  {
    id: serial('id').primaryKey(),
    clickup_task_id: varchar('clickup_task_id', { length: 255 }).notNull().unique(),
    token: varchar('token', { length: 100 }).notNull().unique(),
    first_name: varchar('first_name', { length: 255 }),
    last_name: varchar('last_name', { length: 255 }),
    company: varchar('company', { length: 255 }),
    email: varchar('email', { length: 255 }),
    industry: varchar('industry', { length: 255 }),
    linkedin_url: varchar('linkedin_url', { length: 500 }),
    booking_url: varchar('booking_url', { length: 500 }),
    street: varchar('street', { length: 255 }),
    city: varchar('city', { length: 255 }),
    postal_code: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 100 }),
    anrede: varchar('anrede', { length: 50 }),
    signal_category: varchar('signal_category', { length: 255 }),
    signal_description: text('signal_description'),
    letter_generated_at: timestamp('letter_generated_at'),
    letter_sent_at: timestamp('letter_sent_at'),
    letter_version: varchar('letter_version', { length: 50 }),
    letter_personalized_intro: text('letter_personalized_intro'),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('recipients_token_idx').on(table.token),
    clickupTaskIdIdx: uniqueIndex('recipients_clickup_task_id_idx').on(table.clickup_task_id),
    emailIdx: index('recipients_email_idx').on(table.email),
    createdAtIdx: index('recipients_created_at_idx').on(table.created_at),
  })
);

/**
 * Events table - engagement tracking
 */
export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    recipient_id: serial('recipient_id').notNull(),
    session_id: varchar('session_id', { length: 100 }).notNull(),
    event_type: varchar('event_type', { length: 50 }).notNull(),
    event_value: varchar('event_value', { length: 255 }),
    percent: real('percent'),
    url_path: varchar('url_path', { length: 500 }),
    referrer: varchar('referrer', { length: 500 }),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    recipientIdIdx: index('events_recipient_id_idx').on(table.recipient_id),
    sessionIdIdx: index('events_session_id_idx').on(table.session_id),
    eventTypeIdx: index('events_event_type_idx').on(table.event_type),
    createdAtIdx: index('events_created_at_idx').on(table.created_at),
  })
);

/**
 * Letter templates
 */
export const letterTemplates = pgTable(
  'letter_templates',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    industry: varchar('industry', { length: 255 }),
    subject_line: varchar('subject_line', { length: 255 }),
    body_html: text('body_html').notNull(),
    vimeo_video_id: varchar('vimeo_video_id', { length: 50 }),
    is_default: boolean('is_default').default(false),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('letter_templates_name_idx').on(table.name),
    industryIdx: index('letter_templates_industry_idx').on(table.industry),
    isDefaultIdx: index('letter_templates_is_default_idx').on(table.is_default),
  })
);

/**
 * Landing page templates
 */
export const landingPageTemplates = pgTable(
  'landing_page_templates',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    industry: varchar('industry', { length: 255 }),
    headline: varchar('headline', { length: 500 }),
    subheadline: varchar('subheadline', { length: 500 }),
    cta_button_text: varchar('cta_button_text', { length: 100 }),
    body_html: text('body_html'),
    vimeo_video_id: varchar('vimeo_video_id', { length: 50 }),
    is_default: boolean('is_default').default(false),
    created_at: timestamp('created_at').defaultNow().notNull(),
    updated_at: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('landing_page_templates_name_idx').on(table.name),
    industryIdx: index('landing_page_templates_industry_idx').on(table.industry),
    isDefaultIdx: index('landing_page_templates_is_default_idx').on(table.is_default),
  })
);

/**
 * Relations
 */
export const recipientsRelations = relations(recipients, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  recipient: one(recipients, {
    fields: [events.recipient_id],
    references: [recipients.id],
  }),
}));
