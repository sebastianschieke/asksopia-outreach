/**
 * Environment variable type definitions
 */
declare namespace NodeJS {
  interface ProcessEnv {
    // Database
    DATABASE_URL: string;

    // ClickUp API
    CLICKUP_API_KEY: string;
    CLICKUP_LIST_ID: string;

    // ClickUp Custom Field IDs
    CLICKUP_FIELD_SIGNAL_CATEGORY?: string;
    CLICKUP_FIELD_SIGNAL_DESCRIPTION?: string;
    CLICKUP_FIELD_EMAIL?: string;
    CLICKUP_FIELD_LINKEDIN_URL?: string;
    CLICKUP_FIELD_ADDRESS?: string;
    CLICKUP_FIELD_CITY?: string;
    CLICKUP_FIELD_POSTAL_CODE?: string;
    CLICKUP_FIELD_LANDING_TOKEN?: string;
    CLICKUP_FIELD_ENGAGEMENT_STATUS?: string;
    CLICKUP_FIELD_VIDEO_PROGRESS?: string;
    CLICKUP_FIELD_PAGE_VISITS?: string;
    CLICKUP_FIELD_LAST_ACTIVITY?: string;
    CLICKUP_FIELD_LETTER_SENT?: string;

    // Anthropic API
    ANTHROPIC_API_KEY: string;

    // Admin
    SYNC_PASSWORD: string;

    // Client
    NEXT_PUBLIC_BOOKING_URL?: string;
  }
}
