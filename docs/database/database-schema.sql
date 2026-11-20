-- Database Schema for Syllabus Sync
-- Last Updated: 2026-07-30
--
-- KNOWN DRIFT: this snapshot is hand-maintained and lags the migration chain.
-- It does not show `profiles.faculty` or the faculty column in `user_details`,
-- both of which exist in production. Treat supabase/migrations/ as authoritative
-- and the live catalog as the final word.
--
-- REFERENCE DOCUMENT ONLY
-- =======================
-- This file shows the complete database schema for reference.
-- The actual schema is managed by migration files in: supabase/migrations/
--
-- To apply changes to the database, create new migration files using:
--   supabase migration new migration_name
--
-- See supabase/README.md for more information.
--
-- USER-CENTRIC ARCHITECTURE:
-- =========================
-- This database follows a strict user-centric design where:
-- 1. auth.users.id is the SINGLE source of truth for user identity
-- 2. profiles.id = auth.users.id (1:1 relationship, same UUID)
-- 3. All domain data is OWNED by exactly one user via user_id FK
-- 4. RLS policies enforce complete data isolation between users
--
-- USER DATA FLOW:
-- ==============
-- 1. auth.users: Managed by Supabase Auth (email, password, metadata)
-- 2. profiles: Public user data (full_name, course, year, avatar)
--    - profiles.id = auth.users.id (NOT a separate ID!)
-- 3. gamification_profiles: XP, streaks, levels (linked via user_id)
--
-- When a user signs up:
--   - auth.users row is created by Supabase Auth
--   - on_auth_user_created_safe trigger auto-creates profiles + gamification_profiles
--   - Signup API also creates these as backup (upsert with ON CONFLICT)
--
-- To query all user data together, use the user_details VIEW:
--   SELECT * FROM user_details WHERE id = auth.uid();
-- Or use the get_my_profile() RPC function.
--
-- DATA OWNERSHIP:
-- ==============
-- Every record in domain tables MUST have a user_id that references auth.users.id:
--   - units.user_id (required) - each user has their own units
--   - deadlines.user_id (required) - each user has their own deadlines
--   - events.user_id (nullable) - NULL = public event, set = private user event
--   - notifications.user_id (required) - private to each user
--   - user_preferences.user_id (required, unique) - one per user
--
-- UNIT ISOLATION:
-- ==============
-- Units are normalized PER USER. The constraint units_user_code_unique UNIQUE(user_id, code)
-- ensures that each user can have their own "COMP2310" unit without conflicts.
-- This enables complete data isolation: updating Leo's COMP2310 never affects Kate's.
--
-- IMPORTANT CLARIFICATIONS:
-- ========================
-- 1. user_details is a VIEW (not a table) - it JOINS profiles + gamification_profiles
--    The gamification fields (xp, streak_days, etc.) come from the JOIN, not duplicated
--
-- 2. xp_config uses event_type as PRIMARY KEY (valid design choice)
--    An optional UUID id column was added for tooling consistency
--
-- 3. deadlines uses due_date only (due_at was removed as redundant)
--
-- 4. events table was simplified - legacy fields (event_date, event_time) were REMOVED
--    Now uses only: start_at (required), end_at (optional), all_day (required)
--
-- Migrations Applied:
--   - 20260104000000: Initial schema with tables, indexes, basic RLS
--   - 20260104000001: Fix schema issues
--   - 20260114010403: Add course and year columns to profiles, update views
--   - 20260114011650: Comprehensive fix - user_id columns, gamification, RLS, triggers
--   - 20260114013136: Complete schema audit fix - defaults, orphans, constraints, all_day events
--   - 20260114013519: Add soft deletes, constraints, seed functions
--   - 20260114014506: Schema cleanup - remove due_at, add FK constraints, sync event timestamps
--   - 20260114015445: Simplify events - remove event_date/event_time, standardize on start_at/end_at/all_day
--   - 20260119000000: Multi-user demo seed - creates isolated data for Leo, Raoof, Kate
--   - 20260114000000: Add missing materialized views (analytics, leaderboard, activity)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  course text,
  year text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- Owner of this unit (security: user-scoped data)
  code text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3B82F6',
  description text,
  location jsonb, -- JSONB structure: {"building": "C5C", "room": "204"}
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone, -- Soft delete support
  CONSTRAINT units_pkey PRIMARY KEY (id),
  CONSTRAINT units_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT units_user_code_unique UNIQUE (user_id, code) -- Each user can have unique unit codes
);

CREATE TABLE public.class_times (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  day text NOT NULL CHECK (day = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text, 'Sunday'::text])),
  start_time text NOT NULL, -- "09:00" format
  end_time text NOT NULL, -- "11:00" format
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_times_pkey PRIMARY KEY (id),
  CONSTRAINT class_times_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE,
  CONSTRAINT class_times_time_format CHECK (
    start_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' AND
    end_time ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT class_times_valid_times CHECK (start_time < end_time)
);

CREATE TABLE public.deadlines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, -- Owner of this deadline (security: user-scoped data)
  title text NOT NULL,
  description text,
  unit_code text NOT NULL, -- References unit code (soft reference for flexibility)
  unit_id uuid, -- FK to units table (proper relationship)
  building text, -- Building code for exams (e.g., "C5C")
  room text, -- Room number for exams (e.g., "204")
  color text, -- Custom color override (defaults to unit color)
  due_date timestamp with time zone NOT NULL, -- Single date field (due_at removed)
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority = ANY (ARRAY['Low'::text, 'Medium'::text, 'High'::text, 'Urgent'::text])),
  type text NOT NULL DEFAULT 'Assignment' CHECK (type = ANY (ARRAY['Assignment'::text, 'Exam'::text, 'Quiz'::text, 'Presentation'::text])),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone, -- Soft delete support
  CONSTRAINT deadlines_pkey PRIMARY KEY (id),
  CONSTRAINT deadlines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT deadlines_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL
);

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid, -- Owner of this event (NULL = public/shared event)
  title text NOT NULL,
  description text NOT NULL,
  -- Time fields (simplified - no legacy fields)
  start_at timestamp with time zone NOT NULL, -- Event start (required)
  end_at timestamp with time zone, -- Event end (optional)
  all_day boolean NOT NULL DEFAULT false, -- True for all-day events
  location text NOT NULL,
  building text, -- For map navigation
  room text, -- Room number within building (e.g., "204")
  category text NOT NULL DEFAULT 'Academic' CHECK (category = ANY (ARRAY['Career'::text, 'Social'::text, 'Academic'::text, 'Free Food'::text])),
  color text, -- Custom event color (hex value like "#A6192E")
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone, -- Soft delete support
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT events_valid_time_range CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system' CHECK (type = ANY (ARRAY['deadline'::text, 'event'::text, 'class'::text, 'system'::text])),
  read boolean NOT NULL DEFAULT false,
  link text,
  related_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone, -- Soft delete support
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.user_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme text DEFAULT 'system' CHECK (theme = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])),
  notifications_enabled boolean DEFAULT true,
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- GAMIFICATION SYSTEM
-- ============================================================================

CREATE TABLE public.gamification_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  streak_days integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_activity_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gamification_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT gamification_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.xp_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY[
    'deadline_completed'::text, 'deadline_early'::text, 'daily_login'::text,
    'streak_bonus'::text, 'unit_added'::text, 'event_attended'::text,
    'profile_completed'::text, 'first_deadline'::text, 'weekly_goal'::text, 'level_up_bonus'::text
  ])),
  xp_amount integer NOT NULL CHECK (xp_amount > 0),
  reference_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT xp_events_pkey PRIMARY KEY (id),
  CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- xp_config uses event_type as PRIMARY KEY (valid design)
-- Optional UUID id added for tooling consistency
CREATE TABLE public.xp_config (
  id uuid DEFAULT gen_random_uuid() UNIQUE,
  event_type text PRIMARY KEY,
  base_xp integer NOT NULL CHECK (base_xp > 0),
  description text
);

INSERT INTO public.xp_config (event_type, base_xp, description) VALUES
  ('deadline_completed', 25, 'Completing any deadline'),
  ('deadline_early', 10, 'Bonus for completing 24h+ before due date'),
  ('daily_login', 5, 'First activity of the day'),
  ('streak_bonus', 5, 'Per day of streak (multiplied by streak_days)'),
  ('unit_added', 15, 'Adding a new unit to schedule'),
  ('event_attended', 10, 'Marking a campus event as attended'),
  ('profile_completed', 50, 'One-time bonus for completing profile'),
  ('first_deadline', 25, 'One-time bonus for first deadline completed'),
  ('weekly_goal', 50, 'Completing 5+ deadlines in a week'),
  ('level_up_bonus', 10, 'Bonus XP on level up (multiplied by new level)')
ON CONFLICT (event_type) DO NOTHING;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_units_code ON public.units(code);
CREATE INDEX IF NOT EXISTS idx_units_user_id ON public.units(user_id);
CREATE INDEX IF NOT EXISTS idx_class_times_unit_id ON public.class_times(unit_id);
CREATE INDEX IF NOT EXISTS idx_class_times_day ON public.class_times(day);
CREATE INDEX IF NOT EXISTS idx_deadlines_unit_code ON public.deadlines(unit_code);
CREATE INDEX IF NOT EXISTS idx_deadlines_unit_id ON public.deadlines(unit_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_completed ON public.deadlines(completed);
CREATE INDEX IF NOT EXISTS idx_deadlines_user_id ON public.deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_end_at ON public.events(end_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_profiles_user_id ON public.gamification_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON public.xp_events(created_at);
CREATE INDEX IF NOT EXISTS idx_xp_events_event_type ON public.xp_events(event_type);
CREATE INDEX IF NOT EXISTS idx_xp_events_reference_id ON public.xp_events(reference_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Revoke anonymous access
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.units FROM anon;
REVOKE ALL ON public.class_times FROM anon;
REVOKE ALL ON public.deadlines FROM anon;
REVOKE ALL ON public.events FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.user_preferences FROM anon;
REVOKE ALL ON public.gamification_profiles FROM anon;
REVOKE ALL ON public.xp_events FROM anon;
REVOKE ALL ON public.xp_config FROM anon;

-- Grant to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_times TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.gamification_profiles TO authenticated;
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT SELECT ON public.xp_config TO authenticated;

-- RLS Policies for all tables (see migrations for full policy definitions)
-- Key patterns:
-- - User-owned data: USING (auth.uid() = user_id)
-- - Profile data: USING (auth.uid() = id)
-- - Public + user data (events): USING (user_id IS NULL OR auth.uid() = user_id)
-- - Related data (class_times): USING (EXISTS subquery checking parent ownership)

-- ============================================================================
-- USER DETAILS VIEW
-- ============================================================================
-- NOTE: This is a VIEW, not a table. It JOINS profiles + gamification_profiles
-- to provide all user data in one query. The gamification fields are NOT duplicated.

CREATE OR REPLACE VIEW public.user_details AS
SELECT
    p.id,
    p.email,
    p.full_name,
    p.course,
    p.year,
    p.avatar_url,
    p.created_at,
    p.updated_at,
    gp.xp,
    gp.streak_days,
    gp.longest_streak,
    gp.last_activity_date,
    CASE
        WHEN gp.xp IS NULL OR gp.xp < 0 THEN 1
        ELSE LEAST(100, FLOOR(SQRT(gp.xp::float / 25)) + 1)::integer
    END AS level
FROM public.profiles p
LEFT JOIN public.gamification_profiles gp ON p.id = gp.user_id;

GRANT SELECT ON public.user_details TO authenticated;

-- ============================================================================
-- MATERIALIZED VIEWS (Analytics & Stats)
-- ============================================================================

-- 1. Deadline Analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_deadline_analytics AS
SELECT
    d.user_id,
    COUNT(*) AS total_deadlines,
    COUNT(*) FILTER (WHERE d.completed = true) AS completed_count,
    COUNT(*) FILTER (WHERE d.completed = false) AS pending_count,
    COUNT(*) FILTER (WHERE d.completed = false AND d.due_date < NOW()) AS overdue_count,
    MIN(d.due_date) FILTER (WHERE d.completed = false AND d.due_date > NOW()) AS next_deadline_date
FROM public.deadlines d
GROUP BY d.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_deadline_analytics_key ON public.mv_deadline_analytics(user_id);

-- 2. XP Leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_xp_leaderboard AS
SELECT
    gp.user_id,
    p.full_name,
    p.avatar_url,
    gp.xp,
    gp.streak_days,
    LEAST(100, FLOOR(SQRT(gp.xp::float / 25)) + 1)::integer AS level,
    RANK() OVER (ORDER BY gp.xp DESC) AS rank
FROM public.gamification_profiles gp
JOIN public.profiles p ON gp.user_id = p.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_xp_leaderboard_user_id ON public.mv_xp_leaderboard(user_id);

-- 3. User Activity Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_user_activity_summary AS
SELECT
    gp.user_id,
    gp.last_activity_date,
    gp.streak_days,
    gp.longest_streak,
    (SELECT COUNT(*) FROM public.xp_events xe WHERE xe.user_id = gp.user_id) AS total_actions,
    (SELECT MAX(created_at) FROM public.xp_events xe WHERE xe.user_id = gp.user_id) AS last_action_at
FROM public.gamification_profiles gp;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_summary_user_id ON public.mv_user_activity_summary(user_id);

GRANT SELECT ON public.mv_deadline_analytics TO authenticated;
GRANT SELECT ON public.mv_xp_leaderboard TO authenticated;
GRANT SELECT ON public.mv_user_activity_summary TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_level(p_xp integer)
RETURNS integer AS $$
BEGIN
    IF p_xp < 0 THEN RETURN 1; END IF;
    RETURN LEAST(100, FLOOR(SQRT(p_xp::float / 25)) + 1)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION xp_for_level(p_level integer)
RETURNS integer AS $$
BEGIN
    IF p_level <= 1 THEN RETURN 0; END IF;
    RETURN ((p_level - 1) * (p_level - 1) * 25)::integer;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
    id uuid, email text, full_name text, course text, year text,
    avatar_url text, created_at timestamptz, updated_at timestamptz,
    xp integer, streak_days integer, longest_streak integer, last_activity_date date, level integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Columns listed explicitly on purpose: `SELECT *` into a declared TABLE
    -- type silently breaks when the view changes shape. See migration
    -- 20260730160000_fix_student_id_function_residue.sql (BA-0051).
    RETURN QUERY
    SELECT ud.id, ud.email, ud.full_name, ud.course, ud.year, ud.avatar_url,
           ud.created_at, ud.updated_at, ud.xp, ud.streak_days,
           ud.longest_streak, ud.last_activity_date, ud.level
    FROM public.user_details ud WHERE ud.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_level TO authenticated;
GRANT EXECUTE ON FUNCTION xp_for_level TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
