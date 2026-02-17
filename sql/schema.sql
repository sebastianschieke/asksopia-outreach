-- askSOPia Outreach Database Schema
-- PostgreSQL 12+
-- This file is for reference - use drizzle-kit for migrations in production

CREATE TABLE IF NOT EXISTS recipients (
  id SERIAL PRIMARY KEY,
  clickup_task_id VARCHAR(255) NOT NULL UNIQUE,
  token VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  industry VARCHAR(255),
  linkedin_url VARCHAR(500),
  booking_url VARCHAR(500),
  street VARCHAR(255),
  city VARCHAR(255),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  anrede VARCHAR(50),
  signal_category VARCHAR(255),
  signal_description TEXT,
  letter_generated_at TIMESTAMP,
  letter_sent_at TIMESTAMP,
  letter_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX recipients_token_idx ON recipients(token);
CREATE UNIQUE INDEX recipients_clickup_task_id_idx ON recipients(clickup_task_id);
CREATE INDEX recipients_email_idx ON recipients(email);
CREATE INDEX recipients_created_at_idx ON recipients(created_at);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_value VARCHAR(255),
  percent REAL,
  url_path VARCHAR(500),
  referrer VARCHAR(500),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE CASCADE
);

CREATE INDEX events_recipient_id_idx ON events(recipient_id);
CREATE INDEX events_session_id_idx ON events(session_id);
CREATE INDEX events_event_type_idx ON events(event_type);
CREATE INDEX events_created_at_idx ON events(created_at);

CREATE TABLE IF NOT EXISTS letter_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  subject_line VARCHAR(255),
  body_html TEXT NOT NULL,
  vimeo_video_id VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX letter_templates_name_idx ON letter_templates(name);
CREATE INDEX letter_templates_industry_idx ON letter_templates(industry);
CREATE INDEX letter_templates_is_default_idx ON letter_templates(is_default);

CREATE TABLE IF NOT EXISTS landing_page_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  headline VARCHAR(500),
  subheadline VARCHAR(500),
  cta_button_text VARCHAR(100),
  body_html TEXT,
  vimeo_video_id VARCHAR(50),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX landing_page_templates_name_idx ON landing_page_templates(name);
CREATE INDEX landing_page_templates_industry_idx ON landing_page_templates(industry);
CREATE INDEX landing_page_templates_is_default_idx ON landing_page_templates(is_default);
