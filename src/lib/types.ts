import { z } from 'zod';

/**
 * Recipient schema - cached from ClickUp tasks
 */
export interface Recipient {
  id: number;
  clickup_task_id: string;
  token: string;
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
  created_at: Date | string;
  updated_at: Date | string;
}

export type InsertRecipient = Omit<Recipient, 'id' | 'created_at' | 'updated_at'> & {
  created_at?: Date;
  updated_at?: Date;
};
export type UpdateRecipient = Partial<InsertRecipient>;

/**
 * Event schema - engagement tracking
 */
export type EventType = 'page_view' | 'video_start' | 'video_25' | 'video_50' | 'video_75' | 'video_complete' | 'cta_click';

export interface Event {
  id: number;
  recipient_id: number;
  session_id: string;
  event_type: EventType;
  event_value: string | null;
  percent: number | null;
  url_path: string | null;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
}

export type InsertEvent = Omit<Event, 'id' | 'created_at'>;

/**
 * Letter template schema
 */
export interface LetterTemplate {
  id: number;
  name: string;
  industry: string | null;
  subject_line: string | null;
  body_html: string;
  vimeo_video_id: string | null;
  is_default: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type InsertLetterTemplate = Omit<LetterTemplate, 'id' | 'created_at' | 'updated_at'>;

/**
 * Landing page template schema
 */
export interface LandingPageTemplate {
  id: number;
  name: string;
  industry: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_button_text: string | null;
  body_html: string | null;
  vimeo_video_id: string | null;
  is_default: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export type InsertLandingPageTemplate = Omit<LandingPageTemplate, 'id' | 'created_at' | 'updated_at'>;

/**
 * Recipient summary with computed engagement status
 */
export type EngagementStatus = 'hot' | 'warm' | 'cold' | 'no_interest';

export interface RecipientSummary extends Recipient {
  status: EngagementStatus;
  page_visits: number;
  max_video_percent: number;
  last_cta: string | null;
  last_activity: Date | string | null;
  video_started: boolean;
  repeat_visits: number;
}

/**
 * Landing page data returned to client
 */
export interface LandingPageData {
  recipient: Recipient;
  vimeoVideoId: string;
  bookingUrl: string;
  landingTemplate: LandingPageTemplate | null;
}

/**
 * ClickUp task structure (simplified)
 */
export interface ClickUpCustomField {
  id: string;
  name?: string;
  type?: string;
  value: unknown;
  type_config?: {
    options?: Array<{
      id: string;
      name: string;
      orderindex: number;
    }>;
    [key: string]: unknown;
  };
}

export interface ClickUpTask {
  id: string;
  name: string;
  custom_fields?: ClickUpCustomField[];
  [key: string]: unknown;
}

/**
 * Event validation schema
 */
export const eventSchema = z.object({
  token: z.string().min(1),
  session_id: z.string().min(1),
  event_type: z.enum(['page_view', 'video_start', 'video_25', 'video_50', 'video_75', 'video_complete', 'cta_click']),
  event_value: z.string().nullable().optional(),
  percent: z.number().nullable().optional(),
  url_path: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;
